const { Pool } = require('pg');
const { formulaToSql, sortToSql } = require('./formula');
const _ = require('lodash');
const config = require('config');
const JSON5 = require('json5');

const tables = config.get('airtable.tables');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function listRecords(req, res) {
    console.log('List records called' + JSON.stringify(req.params) + JSON.stringify(req.query));

    const table = req.params.table;

    if (!_.includes(tables, table))
        throw new Error(`Table ${table} not available`);

    const limit = parseInt(req.query.maxRecords) || 100;
    const filter = formulaToSql(req.query.filterByFormula);
    const sort = sortToSql(req.query.sort);
    // const sort = sortToSql(JSON5.parse(req.query.sort));
    const query = `SELECT id,fields,created_time FROM ${table} WHERE ${filter} ORDER BY ${sort} LIMIT ${limit}`;
    console.log(query);
    const result = await pool.query(query);
    res.json({ records: _.map(result.rows, (row) => _.mapKeys(row, (v, k) => _.camelCase(k))) });
}
function createRecord() { }
function retrieveRecord() { }
function deleteRecord() { }
function updateRecord() {
}

module.exports = { listRecords, createRecord, retrieveRecord, deleteRecord, updateRecord };