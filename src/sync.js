const { Pool } = require('pg');
const _ = require('lodash');
const Airtable = require('airtable');
const hash = require('object-hash');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

class Syncronizer {
    constructor(config, changeHooks) {
        this.base = new Airtable({ apiKey: config.apiKey }).base(config.base);
        this.changeHooks = changeHooks;
        this.config = config;
        this.schema = this.config.schema;
    }

    toPgTable(table) {
        return this.schema + '.' + table.replace(/ /, '_');
    }

    async createFunctions() {
        let functions = fs.readFileSync(path.resolve(__dirname, 'functions.sql'), 'utf8');
        await pool.query(functions);
    }

    async createSchema() {
        await pool.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);
    }

    async createTable(table) {
        const pgTable = this.toPgTable(table);
        const isExists = (await pool.query(`SELECT to_regclass('${pgTable}') AS exists`)).rows[0].exists;
        if (!isExists) {
            await pool.query(`CREATE TABLE ${pgTable} (id text, fields jsonb, hash text, created_time timestamp)`);
            console.log(`Table ${pgTable} created`);
        }
    }

    runChangeHooks(entityName, currentState, eventType, entities) {
        const currentStateById = _.keyBy(currentState, 'id');
        _.forEach(entities, (entity) => {
            _.forEach(this.changeHooks || [], (hook) => hook(entityName, eventType, currentStateById[entity.id] || {}, entity));
        })
    }

    syncTable(table, id) {
        const pgTable = this.toPgTable(table);
        const runChangeHooks = this.runChangeHooks.bind(this);

        return new Promise((resolve, reject) => {
            const allValues = [];
            const filter = id ? { filterByFormula: `RECORD_ID()='${id}'` } : {};
            this.base(table).select(filter).eachPage((records, fetchNextPage) => {
                records.forEach(function (record) {
                    allValues.push({
                        id: record.id,
                        fields: record.fields,
                        hash: hash(record.fields),
                        createdTime: record._rawJson.createdTime
                    });
                });
                fetchNextPage();
            }, async error => {
                if (error) {
                    this.syncTable(table, id);
                    return reject(error);
                }

                const currentState = (await pool.query(`SELECT id,fields,hash FROM ${pgTable} ${id && 'WHERE id=$1'}`, _.compact([id]))).rows;
                const added = _.differenceBy(allValues, currentState, 'id');
                const deleted = _.differenceBy(currentState, allValues, 'id');
                const changed = _(allValues)
                    .differenceBy(added, 'id')
                    .differenceBy(deleted, 'id')
                    .differenceBy(currentState, 'hash')
                    .value();

                const addedP = added.map((record) => pool.query(`INSERT INTO ${pgTable} VALUES ($1,$2,$3,$4)`, [record.id, record.fields, record.hash, record.createdTime]));
                const deletedP = deleted.map(({ id }) => pool.query(`DELETE FROM ${pgTable} WHERE id = $1`, [id]));
                const changedP = changed.map(record => pool.query(`UPDATE ${pgTable} SET fields=$1, hash=$2 WHERE id = $3`, [record.fields, record.hash, record.id]));

                await Promise.all(_.flattenDeep([addedP, deletedP, changedP]));

                runChangeHooks(table, currentState, 'insert', added);
                runChangeHooks(table, currentState, 'update', changed);
                runChangeHooks(table, currentState, 'delte', deleted);

                console.log(`${table} (Added: ${added.length}, Changed: ${changed.length}, Deleted: ${deleted.length})`);

                resolve();
            });
        })
    }

    async startSyncronization() {
        for (var i in this.config.tables) {
            await this.syncTable(this.config.tables[i]);
        }
        if (process.env.NODE_ENV === 'production')
            setTimeout(this.startSyncronization.bind(this), 1000);
    }

    async setupPeriodicUpdate() {
        await this.createFunctions();
        await this.createSchema();
        await Promise.all(this.config.tables.map(this.createTable.bind(this)));

        await this.startSyncronization();
    }
}

module.exports = Syncronizer;
