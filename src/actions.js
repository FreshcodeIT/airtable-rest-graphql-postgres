const { Pool } = require('pg');
const { formulaToSql, sortToSql } = require('./formula');
const Airtable = require('airtable');
const _ = require('lodash');
const Syncronizer = require('./sync');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

class AirtableRest {
    constructor(config) {
        this.config = config;
        this.base = new Airtable({ apiKey: config.apiKey }).base(config.base);
        this.onChangeHooks = [];
        this.onSelectHooks = [_.identity];
        this.schema = this.config.schema;
        this.sync = new Syncronizer(config, this.onChangeHooks);
    }

    setupPeriodicUpdate() {
        return this.sync.setupPeriodicUpdate(this.config, this.onChangeHooks);
    }

    validateTable(table) {
        if (!_.includes(this.config.tables, table))
            throw new Error(`Table ${table} not available`);
    }

    prepareResult(entity) {
        const convertedKeys = _.mapKeys(entity, (v, k) => _.camelCase(k));
        const appliedHooks = _.reduce(this.onSelectHooks, (result, fn) => fn(result), convertedKeys);
        return convertedKeys;
    }

    async listRecords(req, res) {
        const table = req.params.table;

        this.validateTable(table);

        const limit = parseInt(req.query.maxRecords) || 100;
        const filter = formulaToSql(req.query.filterByFormula);
        const sort = sortToSql(req.query.sort);
        const query = `SELECT id,fields,created_time FROM ${this.schema}.${table} WHERE ${filter} ORDER BY ${sort} LIMIT ${limit}`;
        console.log(query);
        const result = await pool.query(query);
        res.json({ records: _.map(result.rows, this.prepareResult.bind(this)) });
    }

    async createRecord(req, res) {
        const table = req.params.table;

        this.validateTable(table);

        const result = await this.base(table).create(req.body.fields);
        await this.sync.syncTable(table, result.id);
        res.json(result['_rawJson']);
    }

    async retrieveRecord(req, res) {
        const table = req.params.table;
        const id = req.params.id;

        this.validateTable(table)

        const query = `SELECT id,fields,created_time FROM ${this.schema}.${table} WHERE id=${id}`;
        const result = await pool.query(query);
        res.json(prepareResult(result.rows[0]));
    }

    async deleteRecord() {

    }

    async updateRecord(req, res) {
        const table = req.params.table;
        const id = req.params.id;
        const result = await this.base(table).update(id, req.body.fields);
        await this.sync.syncTable(table, id);
        res.json(result['_rawJson']);
    }

    onChange(handler) {
        this.onChangeHooks.push(handler);
    }
}

module.exports = AirtableRest;