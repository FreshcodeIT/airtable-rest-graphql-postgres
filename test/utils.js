const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function clearPostgresTable(table) {
    await pool.query(`DELETE FROM ${table}`);
}

async function clearAirtableBase(apiKey, baseId) {
    const base = new Airtable({ apiKey }).base(baseId);
}

process.on('unhandledRejection', e => { throw e; });

module.exports = {clearAirtableBase, clearPostgresTable};