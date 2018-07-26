const { Pool } = require('pg');
const Airtable = require('airtable');
const {syncTableFromScratch} = require('./sync');

var config = require('config');

var base = new Airtable({ apiKey: config.get('airtable.apiKey') }).base(config.get('airtable.base'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

/**
 * 
 */
function cleanObjectFromFk(object, allIds) {
    return {
        id: object.id,
        fields: _.mapValues(object.fields, (value) => {
            if (_.isArray(value))
                return _.without(value, allIds);
            else if (_.includes(allIds, value))
                return null;
        })
    };
}

/**
 * Without proper metadata API we can cleanup foreign key relations in two steps:
 * 1. Gather ID's of all objects in database
 * 2. Remove all mentions of this ID's using strict equality
 */
async function getAllObjectsWithoutKeys(tables) {
    const allObectsGrouped = await Promise.all(_.map(tables, async (table) => {
        const rows = (await pool.query(`SELECT id,fields FROM ${table}`)).rows;
        return _.map(rows, obj => _.assign({ __tableName: table }, obj));
    }));
    const allObjectsFlat = _.flatten(allObectsGrouped);
    console.log(allObjectsFlat);
    const allIds = _.map(allObjectsFlat, 'id');
    return _.map(allObjectsFlat, (object) => cleanObjectFromFk(object, allIds));
}

/**
 * Because we can't enforce Airtable to assign old ID's of the objects we should keep track of new generated id's and associate 
 * them with old id's to be able later recreate relations
 */
async function restorePlainObjects(objectsWithoutFk) {
    const oldIdToNewMapping = await Promise.all(_.map(objectsWithoutFk, async (obj) => {
        const id = (await base(table).create(obj)).id;
        return [obj.id, id];
    }));
    return _.fromPairs(oldIdToNewMapping);
}

async function restoreRelations() {

}

/**
 * Sync Postgres database content to Airtable, usefull for restoring from backup after Airtable database loss. Airtable schema should be in place, only data are synced.
 * NOTE: without metadata API very hard to track dependencies between tables that's why restore is 2-step process:
 * 1. Restore objects with empty relations
 * 2. Restore all relations
 * 
 * Also airtable have constraint for 5requests/sec and no batch insert or batch update API.
 * For free plan(1200 records) it can take (1200 / 5) / 60 = 4 minutes to restore full database once, and extra 4 minutes for restore foreign keys
 */
function syncPostgresToAirtable(tables) {
    const objectsWithoutFk = getAllObjectsWithoutKeys(tables);
    const oldIdToNewMapping = restorePlainObjects(objectsWithoutFk);
    console.log(oldIdToNewMapping);
    restoreRelations();
}