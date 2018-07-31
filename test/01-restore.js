const config = require('config');
const _ = require('lodash');
const restore = require('../src/restore');

async function syncAll() {
    const tables = config.get('airtable.tables');
    const sourceDatabase = '';
    const destinationDatabase = 'appyIPW73BwV0EYsH';

    clearAirtableBase(null, destinationDatabase);

    // TODO : ensure that base is empty

    // Sync Source Airtable to local Postgres
    await Promise.all(_.map(tables, syncTableFromScratch));

    // Restore from local Postgres to Destination Airtable
    await restore(destinationDatabase, tables);
}

// syncAll();