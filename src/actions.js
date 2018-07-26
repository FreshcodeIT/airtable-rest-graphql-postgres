const { Pool } = require('pg');
const { formulaToSql, sortToSql } = require('./formula');
const Airtable = require('airtable');
const _ = require('lodash');
const config = require('config');
const { syncTable } = require('./sync');

const tables = config.get('airtable.tables');

var base = new Airtable({ apiKey: config.get('airtable.apiKey') }).base(config.get('airtable.base'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function listRecords(req, res) {
    const table = req.params.table;

    if (!_.includes(tables, table))
        throw new Error(`Table ${table} not available`);

    const limit = parseInt(req.query.maxRecords) || 100;
    const filter = formulaToSql(req.query.filterByFormula);
    const sort = sortToSql(req.query.sort);
    const query = `SELECT id,fields,created_time FROM ${table} WHERE ${filter} ORDER BY ${sort} LIMIT ${limit}`;
    console.log(query);
    const result = await pool.query(query);
    res.json({ records: _.map(result.rows, (row) => _.mapKeys(row, (v, k) => _.camelCase(k))) });
}

async function createRecord(req, res) {
    const table = req.params.table;
    const result = await base(table).create(req.body.fields);
    await syncTable(table, result.id);
    res.json(result['_rawJson']);
}

async function retrieveRecord(req, res) {
    const table = req.params.table;
    const id = req.params.id;

    if (!_.includes(tables, table))
        throw new Error(`Table ${table} not available`);

    const query = `SELECT id,fields,created_time FROM ${table} WHERE id=${id}`;
    const result = await pool.query(query);
    res.json(_.mapKeys(result.rows[0], (v, k) => _.camelCase(k)));
}

function deleteRecord() { 
    
}

async function updateRecord(req, res) {
    const table = req.params.table;
    const id = req.params.id;
    const result = await base(table).update(id, req.body.fields);
    await syncTable(table, id);
    res.json(result['_rawJson']);
}

module.exports = { listRecords, createRecord, retrieveRecord, deleteRecord, updateRecord };