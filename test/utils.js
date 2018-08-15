let chai = require('chai');
let chaiHttp = require('chai-http');
const { Pool } = require('pg');
let config = require('../config/test');
const _ = require('lodash');

chai.use(chaiHttp);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function clearPostgresTable(table) {
    await pool.query(`DELETE FROM ${config.schema}.${table}`);
}

async function clearAirtableBase(apiKey, baseId, entities) {
    const base = new Airtable({ apiKey }).base(baseId);
}

function selectAndCompareLocalAndRemote(server, url) {
    return Promise
        .all([
            chai.request(server).get(`/v0/${config.base}/${url}`),
            chai.request(`https://api.airtable.com/v0/${config.base}`).get(url).set('Authorization', `Bearer ${config.apiKey}`)
        ])
        .then(([local, airtable]) => {
            const nameField = 'fields.Name';
            const localRecords = _.sortBy(local.body.records, nameField);
            const airtableRecords = _.sortBy(airtable.body.records, nameField);
            chai.expect(_.map(localRecords, nameField)).to.be.deep.equal(_.map(airtableRecords, nameField));
            chai.expect(localRecords).to.be.deep.equal(airtableRecords);
            chai.expect(localRecords.length).to.not.equal(0);
            return [local, airtable];
        });
}

async function getSingleEntity(table, id) {
    const res = await chai.request(`https://api.airtable.com/v0/${config.base}`).get(`/${table}/${id}`).set('Authorization', `Bearer ${config.apiKey}`)
    return res.body;
}

async function getEntitiesAsMap(table, groupKey) {
    const result = (await pool.query(`select id,fields from ${table}`)).rows;
    return _.fromPairs(_.map(result, (ent) => [ent.fields[groupKey], ent.id]));
}

async function getEntitiesCount(table) {
    return parseInt((await pool.query(`select count(*) as cnt from ${table}`)).rows[0].cnt);
}

process.on('unhandledRejection', e => { throw e; });

module.exports = {clearAirtableBase, clearPostgresTable, selectAndCompareLocalAndRemote, getSingleEntity, pool, getEntitiesAsMap, getEntitiesCount};