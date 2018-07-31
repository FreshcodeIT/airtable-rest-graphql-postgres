const config = require('config');
const _ = require('lodash');
const restore = require('../src/restore');
const airql = require('../index');
const Airtable = require('airtable');
const { pool } = require('./utils');
const chai = require('chai');

async function clearAirtableTable(schema, base, table) {
    const ids = (await pool.query(`select id from ${schema}.${table}`)).rows;
    for (let i in ids) {
        await base(table).destroy(ids[i].id);
    }
}

describe('Restore', async function () {
    this.timeout(20000);

    const tables = config.tables;
    const sourceDatabase = 'appOqesCBzpUDkCRa';
    const destinationDatabase = 'appi7MJY9TJIqNNJj';

    const apiKey = 'keymYek7PsWGf6j7i';

    const commonConfig = { tables, apiKey };

    const base = new Airtable({ apiKey }).base(destinationDatabase);

    before(async () => {
        // Sync Source Airtable to local Postgres
        await pool.query(`DROP SCHEMA IF EXISTS source CASCADE`);
        let sourceAirtable = airql.airtableRestRouter(_.assign({ base: sourceDatabase, schema: 'source' }, commonConfig)).airtable;
        await sourceAirtable.setupPeriodicUpdate();

        // Clear destination database
        await pool.query(`DROP SCHEMA IF EXISTS target CASCADE`);
        let destinationAirtable = airql.airtableRestRouter(_.assign({ base: destinationDatabase, schema: 'target' }, commonConfig)).airtable;
        await destinationAirtable.setupPeriodicUpdate();
        console.log('Sync done');
        for (let i in tables) {
            await clearAirtableTable('target', base, tables[i]);
        }
        console.log('Clear done');
    });

    // Ensure that destination database is empty
    it('destination table should be empty', async () => {
        for (let i in tables) {
            const result = (await base(tables[i]).select({}).firstPage());
            chai.expect(result.length == 0).to.be.true;
        }
    });

    it('after restore content of two airtable bases should be identical', async () => {
        await restore(destinationDatabase, apiKey, 'source', tables);
        // TODO : think how compare two databases with different id's but with same content
        // IDEA : build deep nested graph that represent whole database, remove id field and then deeply compare graphs
    });
})