const { Pool } = require('pg');
const Airtable = require('airtable');
const _ = require('lodash');
const config = require('config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

function cleanObjectFromFk(object, allIds) {
    return {
        id: object.id,
        __tableName: object.__tableName,
        fields: _.mapValues(object.fields, (value) => {
            if (_.isArray(value)) {
                if (_.every(value, _.isObject))
                    return _.map(value, ({ url, filename }) => ({ url, filename }));
                else
                    return _.difference(value, allIds);
            }
            else if (_.includes(allIds, value))
                return null;
            return value;
        })
    };
}

function replaceOldFKtoNewFK(fields, oldIdToNewMapping) {
    return _.pickBy(_.mapValues(fields, (value) => {
        if (_.isArray(value)) {
            if (_.every(value, _.isObject))
                return null;
            else
                return _.map(value, (val) => oldIdToNewMapping[val]);
        }
        else
            return oldIdToNewMapping[value];
    }));
}

async function getAllObjects(schema, tables) {
    const allObectsGrouped = await Promise.all(_.map(tables, async (table) => {
        const rows = (await pool.query(`SELECT id,fields FROM ${schema}.${table}`)).rows;
        return _.map(rows, obj => _.assign({ __tableName: table }, obj));
    }));
    return _.flatten(allObectsGrouped);
}

/**
 * Without proper metadata API we can cleanup foreign key relations in two steps:
 * 1. Gather ID's of all objects in database
 * 2. Remove all mentions of this ID's using strict equality
 */
async function getAllObjectsWithoutKeys(allObjects) {
    const allIds = _.map(allObjects, 'id');
    return _.map(allObjects, (object) => cleanObjectFromFk(object, allIds));
}

async function restoreSinglePlainObject(base, excludeFields, obj) {
    const { __tableName, fields, id } = obj;
    try {
        const newId = (await base(__tableName).create(_.omit(fields, excludeFields))).id;
        return [id, newId];
    } catch (e) {
        if (e.error === 'INVALID_VALUE_FOR_COLUMN') {
            // TODO : remove this hack when get proper metadata
            const field = e.message.match(/Field (.*?) can not accept value/);
            console.log("Computed:" + field[1]);
            excludeFields.push(field[1]);
            return restoreSinglePlainObject(base, excludeFields, obj);
        }
        console.log(obj);
        console.log(e)
    };
}

/**
 * Because we can't enforce Airtable to assign old ID's of the objects we should keep track of new generated id's and associate 
 * them with old id's to be able later recreate relations
 */
async function restorePlainObjects(base, objectsWithoutFk) {
    const excludeFields = [];
    const oldIdToNewMapping = await Promise.all(_.map(objectsWithoutFk, _.partial(restoreSinglePlainObject, base, excludeFields)));
    return { oldIdToNewMapping: _.fromPairs(oldIdToNewMapping), excludeFields };
}

function restoreRelations(base, allObjects, { oldIdToNewMapping, excludeFields }) {
    return Promise.all(_.map(allObjects, ({ __tableName, fields, id }) => base(__tableName).update(oldIdToNewMapping[id], replaceOldFKtoNewFK(_.omit(fields, excludeFields), oldIdToNewMapping))));
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
async function restoreAirtableFromPostgres(targetBase, apiKey, schema, tables) {
    try {
        var base = new Airtable({ apiKey }).base(targetBase);
        const allObjects = await getAllObjects(schema, tables);
        const objectsWithoutFk = await getAllObjectsWithoutKeys(allObjects);
        const plainObjectRestoreMetainfo = await restorePlainObjects(base, objectsWithoutFk);
        console.log(plainObjectRestoreMetainfo);
        await restoreRelations(base, allObjects, plainObjectRestoreMetainfo);
    } catch (e) {
        console.log(e);
    }
}

module.exports = restoreAirtableFromPostgres;
