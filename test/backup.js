const { syncTableFromScratch } = require('../src/sync');
const config = require('config');
const _ = require('lodash');
const restore = require('../src/backup');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function syncTableFromScratch(table) {
    await createTable(table);
    await pool.query(`DELETE FROM ${table}`);
    await syncTable(table);
}

async function syncAll() {
    await Promise.all(_.map(config.get('airtable.tables'), syncTableFromScratch));
    await restore('appyIPW73BwV0EYsH', config.get('airtable.tables'));
}

syncAll();