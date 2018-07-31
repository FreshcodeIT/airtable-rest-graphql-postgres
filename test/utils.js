let chai = require('chai');
let chaiHttp = require('chai-http');
const { Pool } = require('pg');
let config = require('../config/test');

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
            chai.request(server).get(url),
            chai.request(`https://api.airtable.com/v0/${config.base}`).get(url).set('Authorization', `Bearer ${config.apiKey}`)
        ])
        .then(([local, airtable]) => {
            chai.expect(local.body.records).to.be.deep.equal(airtable.body.records);
            chai.expect(local.body.records.length > 0).to.be.true;
            return [local, airtable];
        });
}

async function getSingleEntity(table, id) {
    const res = await chai.request(`https://api.airtable.com/v0/${config.base}`).get(`/${table}/${id}`).set('Authorization', `Bearer ${config.apiKey}`)
    return res.body;
}

process.on('unhandledRejection', e => { throw e; });

module.exports = {clearAirtableBase, clearPostgresTable, selectAndCompareLocalAndRemote, getSingleEntity};