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
        this.onSelectHooks = [(user, table, res) => res];
        this.schema = this.config.schema;
        this.sync = new Syncronizer(config, this.onChangeHooks);
        this.assignUser = _.identity;
    }

    setupPeriodicUpdate() {
        return this.sync.setupPeriodicUpdate(this.config, this.onChangeHooks);
    }

    validateTable(table) {
        if (!_.includes(this.config.tables, table))
            throw new Error(`Table ${table} not available`);
    }

    prepareResult(user, table, entity) {
        const convertedKeys = _.mapKeys(entity, (v, k) => _.camelCase(k));
        const appliedHooks = _.reduce(this.onSelectHooks, (result, fn) => fn(user, table, result), convertedKeys);
        return appliedHooks;
    }

    async listRecords(req, res) {
        const table = req.params.table;
        const user = this.assignUser(req, res);
    
        this.validateTable(table);

        const maxRecords = parseInt(req.query.maxRecords);
        let pageSize = parseInt(req.query.pageSize) || 100;
        const offset = parseInt(req.query.offset) || 0;

        if (maxRecords && (offset + pageSize) > maxRecords) {
            pageSize = maxRecords - offset;
        }

        const filter = formulaToSql(req.query.filterByFormula);
        const sort = sortToSql(req.query.sort);
        const query = `SELECT id,fields,created_time FROM ${this.sync.toPgTable(table)} WHERE ${filter} ORDER BY ${sort} LIMIT ${pageSize+1} OFFSET ${offset}`;
        console.log(query);
        const result = (await pool.query(query)).rows;
        const moreRecords = result.length > pageSize;
        const skipFirstRecords = moreRecords ? _.initial : _.identity;
        res.json({ records: _.map(skipFirstRecords(result), this.prepareResult.bind(this, user, table)), offset: moreRecords ? (pageSize + offset) : null});
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
        const user = this.assignUser(req, res);

        const id = req.params.id;

        this.validateTable(table);

        const query = `SELECT id,fields,created_time FROM ${this.sync.toPgTable(table)} WHERE id='${id}'`;
        const result = await pool.query(query);
        if (result.rows.length) res.json(this.prepareResult(user, table, result.rows[0]));
        else res.status(404).send('Not found');
    }

    async deleteRecord(req, res) {
        const table = req.params.table;
        const id = req.params.id;
        const result = await this.base(table).destroy(id);
        await this.sync.syncTable(table);
        res.json({deleted: true, id: result.id});
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

    onSelect(handler) {
        this.onSelectHooks.push(handler);
    }

    onAssignUser(handler) {
        this.assignUser = handler;
    }
}

module.exports = AirtableRest;