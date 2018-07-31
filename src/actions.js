const { Pool } = require('pg');
const { formulaToSql, sortToSql } = require('./formula');
const Airtable = require('airtable');
const _ = require('lodash');
const { syncTable } = require('./sync');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

function prepareResult(entity) {
    return _.mapKeys(entity, (v, k) => _.camelCase(k));
}

class AirtableRest {
    constructor(config) {
        this.config = config;
        this.base = new Airtable({ apiKey: config.apiKey }).base(config.base);
    }

    validateTable(table) {
        if (!_.includes(this.config.tables, table))
            throw new Error(`Table ${table} not available`);
    }

    async listRecords(req, res) {
        const table = req.params.table;

        this.validateTable(table);

        const limit = parseInt(req.query.maxRecords) || 100;
        const filter = formulaToSql(req.query.filterByFormula);
        const sort = sortToSql(req.query.sort);
        const query = `SELECT id,fields,created_time FROM ${table} WHERE ${filter} ORDER BY ${sort} LIMIT ${limit}`;
        console.log(query);
        const result = await pool.query(query);
        res.json({ records: _.map(result.rows, prepareResult) });
    }

    async createRecord(req, res) {
        const table = req.params.table;

        this.validateTable(table);

        const result = await this.base(table).create(req.body.fields);
        await syncTable(this.base, table, result.id);
        res.json(result['_rawJson']);
    }

    async retrieveRecord(req, res) {
        const table = req.params.table;
        const id = req.params.id;

        this.validateTable(table)

        const query = `SELECT id,fields,created_time FROM ${table} WHERE id=${id}`;
        const result = await pool.query(query);
        res.json(prepareResult(result.rows[0]));
    }

    async deleteRecord() {

    }

    async updateRecord(req, res) {
        const table = req.params.table;
        const id = req.params.id;
        const result = await this.base(table).update(id, req.body.fields);
        await syncTable(this.base, table, id);
        res.json(result['_rawJson']);
    }
}

module.exports = AirtableRest;