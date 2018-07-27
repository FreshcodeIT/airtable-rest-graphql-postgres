const { Pool } = require('pg');
const _ = require('lodash');
const Airtable = require('airtable');
const hash = require('object-hash');
var config = require('config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const onChangeHooks = [];

async function createTable(table) {
    const isExists = (await pool.query(`SELECT to_regclass('${table}') AS exists`)).rows[0].exists;
    if (!isExists) {
        await pool.query(`CREATE TABLE ${table} (id text, fields jsonb, hash text, created_time timestamp)`);
        console.log(`Table ${table} created`);
    }
}

function runChangeHooks(eventType, entities) {
    _.forEach(entities, (entity) => {
        _.forEach(onChangeHooks, (hook) => hook(eventType, entity));
    })
}

function syncTable(base, table, id) {
    return new Promise((resolve, reject) => {
        const allValues = [];
        const filter = id ? { filterByFormula: `RECORD_ID()='${id}'` } : {};
        base(table).select(filter).eachPage(function page(records, fetchNextPage) {
            records.forEach(function (record) {
                allValues.push({
                    id: record.id,
                    fields: record.fields,
                    hash: hash(record.fields),
                    createdTime: record._rawJson.createdTime
                });
            });
            fetchNextPage();
        }, async function done(error) {
            if (error)
                return reject(error);

            const currentState = (await pool.query(`SELECT id,hash FROM ${table}`)).rows;
            const added = _.differenceBy(allValues, currentState, 'id');
            const deleted = _.differenceBy(currentState, allValues, 'id');
            const changed = _(allValues)
                .differenceBy(added, 'id')
                .differenceBy(deleted, 'id')
                .differenceBy(currentState, 'hash')
                .value();

            const addedP = added.map((record) => pool.query(`INSERT INTO ${table} VALUES ($1,$2,$3,$4)`, [record.id, record.fields, record.hash, record.createdTime]));
            const deletedP = deleted.map(({ id }) => pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]));
            const changedP = changed.map(record => pool.query(`UPDATE ${table} SET fields=$1, hash=$2 WHERE id = $3`, [record.fields, record.hash, record.id]));

            await Promise.all(_.flattenDeep([addedP, deletedP, changedP]));

            runChangeHooks('insert', added);
            runChangeHooks('update', changed);
            runChangeHooks('delte', deleted);

            console.log(`${table} (Added: ${added.length}, Changed: ${changed.length}, Deleted: ${deleted.length})`);

            resolve();
        });
    })
}

function registerOnChangeHandler(handler) {
    onChangeHooks.push(handler);
}

async function processAndScheduleAllTables(base) {
    const tables = config.get('airtable.tables');
    for (var i in tables) {
        await syncTable(base, tables[i]);
    }
    setTimeout(processAndScheduleAllTables, 1000);
}

async function init() {
    const base = new Airtable({ apiKey: config.get('airtable.apiKey') }).base(config.get('airtable.base'));
    await Promise.all(config.get('airtable.tables').map(createTable));
    await processAndScheduleAllTables(base);
}

module.exports = {
    init,
    syncTable,
    registerOnChangeHandler
};
