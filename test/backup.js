const { syncTableFromScratch } = require('../src/sync');
const config = require('config');
const _ = require('lodash');
const restore = require('../src/backup');

async function syncAll() {
    await Promise.all(_.map(config.get('airtable.tables'), syncTableFromScratch));
    await restore('appyIPW73BwV0EYsH', config.get('airtable.tables'));
}

syncAll();