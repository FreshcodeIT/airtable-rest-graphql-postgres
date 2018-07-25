const { Pool } = require('pg');
const _ = require('lodash');
const Airtable = require('airtable');
const hash = require('object-hash');
var config = require('config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function createTable(table) {
    const isExists = (await pool.query(`SELECT to_regclass('${table}') AS exists`)).rows[0].exists;
    if (!isExists) {
        await pool.query(`CREATE TABLE ${table} (id text, fields jsonb, hash text, created_time timestamp)`);
        console.log(`Table ${table} created`);
    }
}

var base = new Airtable({ apiKey: config.get('airtable.apiKey') }).base(config.get('airtable.base'));

function syncTable(table) {
    return new Promise((resolve, reject) => {
        const allValues = [];
        base(table).select({}).eachPage(function page(records, fetchNextPage) {
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

            const currentState = (await pool.query(`SELECT id,hash FROM Property`)).rows;
            const added = _.differenceBy(allValues, currentState, 'id');
            const deleted = _.differenceBy(currentState, allValues, 'id');
            const changed = _(allValues)
                .differenceBy(added, 'id')
                .differenceBy(deleted, 'id')
                .differenceBy(currentState, 'hash')
                .value();

            const addedP = added.map((record) => pool.query(`INSERT INTO Property VALUES ($1,$2,$3,$4)`, [record.id, record.fields, record.hash, record.createdTime]));
            const deletedP = deleted.map(({ id }) => pool.query(`DELETE FROM Property WHERE id = $1`, [id]));
            const changedP = changed.map(record => pool.query(`UPDATE Property SET fields=$1, hash=$2 WHERE id = $3`, [record.fields, record.hash, record.id]));

            await Promise.all(_.flattenDeep([addedP, deletedP, changedP]));

            resolve();
        });
    })
}

function syncRecord(table, id) {

}

async function syncTableFromScratch(table) {
    await pool.query(`DELETE FROM ${table}`);
    await syncTable(table);
}

module.exports = { init: () => Promise.all(config.get('airtable.tables').map(createTable)), syncTableFromScratch };
