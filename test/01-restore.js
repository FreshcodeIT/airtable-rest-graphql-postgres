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

function embedValues(allEntities, root) {
    let embedded = false;
    do {
        embedded = false;
        _.forEach(
            allEntities,
            (ent) => _.forEach(ent, (val, key) => {
                if (_.isArray(val)) {
                    ent[key] = _.map(val, (v) => {
                        // simple cycle detection - when we meet 'root' entity - stop
                        if (allEntities[v]) {
                            if (allEntities[v].__type !== root) {
                                embedded = true;
                                return allEntities[v];
                            }
                            else return allEntities[v].Name;
                        }
                        return v;
                    });
                    ent[key] = _.sortBy(ent[key], 'Name');
                }
            }));
    } while (embedded);

    // return only values with type 'root'
    return _.filter(_.values(allEntities), (v) => v.__type === root);
}

async function buildDeepTree(base, tables, root) {
    // gather all entities from all tables
    const allEntities = {};
    for (let i in tables) {
        const result = (await base(tables[i]).select({}).firstPage());
        const groupedResult = _.keyBy(_.map(result, (v) => _.assign(v.fields, { __type: tables[i], id: v.id })), 'id');
        _.assign(allEntities, groupedResult);
    }

    // remove unnesecary fields
    _.forEach(allEntities, (v) => {
        _.unset(v, 'id');
        _.unset(v, 'Created time');
        _.unset(v, 'Attachements[0].thumbnails'); // it's not enough time to generate thumbnails from Airtable side
        _.unset(v, 'Attachements[0].id');
        _.unset(v, 'Attachements[0].url');
    });

    return _.sortBy(embedValues(allEntities, root), 'Name');
}

describe('Deep tree embed', async function () {
    it('embed correctly', () => {
        const allValues = {
            p1: { __type: 'Property', id: 'p1', Name: 'Prop1', landlord: ['l1'], features: ['f1', 'f2'] },
            l1: { __type: 'Landlord', id: 'l1', Name: 'Land1', properties: ['p1'] },
            f1: { __type: 'Feature', id: 'f1', Name: 'Feature1', properties: ['p1'] },
            f2: { __type: 'Feature', id: 'f2', Name: 'Feature2', properties: ['p1'] }
        };

        const correctTree = [
            {
                "__type": "Property",
                "id": "p1",
                "Name": "Prop1",
                "landlord": [{ "__type": "Landlord", "id": "l1", "Name": "Land1", "properties": ["Prop1"] }],
                "features": [
                    { "__type": "Feature", "id": "f1", "Name": "Feature1", "properties": ["Prop1"] },
                    { "__type": "Feature", "id": "f2", "Name": "Feature2", "properties": ["Prop1"] }
                ]
            }
        ];

        chai.expect(embedValues(allValues, 'Property')).to.be.deep.equal(correctTree);
    });
})

describe('Restore', async function () {
    this.timeout(20000);

    const tables = config.tables;
    const sourceDatabase = 'appOqesCBzpUDkCRa';
    const destinationDatabase = 'appi7MJY9TJIqNNJj';

    const apiKey = 'keymYek7PsWGf6j7i';

    const commonConfig = { tables, apiKey };

    const destinationAirtableApi = new Airtable({ apiKey }).base(destinationDatabase);
    const sourceAirtableApi = new Airtable({ apiKey }).base(sourceDatabase);

    before(async () => {
        // Sync Source Airtable to local Postgres
        await pool.query(`DROP SCHEMA IF EXISTS source CASCADE`);
        let sourceAirql = airql.airtableRestRouter(_.assign({ base: sourceDatabase, schema: 'source' }, commonConfig)).airtable;
        await sourceAirql.setupPeriodicUpdate();

        // Clear destination database
        await pool.query(`DROP SCHEMA IF EXISTS target CASCADE`);
        let destinationAirql = airql.airtableRestRouter(_.assign({ base: destinationDatabase, schema: 'target' }, commonConfig)).airtable;
        await destinationAirql.setupPeriodicUpdate();
        console.log('Sync done');
        for (let i in tables) {
            await clearAirtableTable('target', destinationAirtableApi, tables[i]);
        }
        console.log('Clear done');
    });

    // Ensure that destination database is empty
    it('destination table should be empty', async () => {
        for (let i in tables) {
            const result = (await destinationAirtableApi(tables[i]).select({}).firstPage());
            chai.expect(result.length == 0).to.be.true;
        }
    });

    it('after restore content of two airtable bases should be identical', async () => {
        await restore(destinationDatabase, apiKey, 'source', tables);
        // IDEA : build deep nested graph that represent whole database, remove id field and then deeply compare graphs
        const dstBase = await buildDeepTree(destinationAirtableApi, tables, 'Property');
        const srcBase = await buildDeepTree(sourceAirtableApi, tables, 'Property');
        chai.expect(dstBase).to.be.deep.equal(srcBase);
    });
})