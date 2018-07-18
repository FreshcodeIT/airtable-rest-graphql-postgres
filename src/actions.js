const { Pool } = require('pg');
const formulaToSql = require('./formula');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function listRecords(req, res) {
    console.log('List records called' + JSON.stringify(req.params) + JSON.stringify(req.query));
    const table = req.params.table;
    const limit = parseInt(req.query.maxRecords) || 100;
    const filter = formulaToSql(req.query.filterByFormula);
    console.log(`SELECT * FROM ${table} WHERE ${filter} LIMIT ${limit}`);
    const result = await pool.query(`SELECT * FROM ${table} WHERE ${filter} LIMIT ${limit}`);
    res.json({records: result.rows});
    // query.exec((err, books) => {
    //     if(err) res.send(err);
    //     res.json(books);
    // });
}
function createRecord() { }
function retrieveRecord() { }
function deleteRecord() { }
function updateRecord() {
}

module.exports = { listRecords, createRecord, retrieveRecord, deleteRecord, updateRecord };