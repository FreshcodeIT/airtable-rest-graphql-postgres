const config = require('config');
const _ = require('lodash');
const restore = require('../src/restore');
const airql = require('../index');

async function syncAll() {
    const tables = config.get('airtable.tables');
    const sourceDatabase = '';
    const destinationDatabase = 'appyIPW73BwV0EYsH';
    const key = 'keymYek7PsWGf6j7i';

    let sourceAirtable = airql.airtableRestRouter({ apiKey: key, base: sourceDatabase }).airtable;

    // Clear destination database
    clearAirtableBase(key, destinationDatabase);

    // Ensure that destination database is empty

    // Sync Source Airtable to local Postgres
    await Promise.all(_.map(tables, clearPostgresTable('Property')));
    await sourceAirtable.setupPeriodicUpdate();

    // Restore from local Postgres to Destination Airtable
    await restore(destinationDatabase, tables);
}

// syncAll();