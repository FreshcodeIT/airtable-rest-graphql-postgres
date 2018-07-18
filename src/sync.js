const { Pool, Client } = require('pg');
const _ = require('lodash');
const Airtable = require('airtable');
const hash = require('object-hash');

const tables = ['Property', 'Room', 'Landlord', 'Agent'];

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function createTable(table) {
    const isExists = (await pool.query(`SELECT to_regclass('${table}') AS exists`)).rows[0].exists;
    if (!isExists) {
        await pool.query(`CREATE TABLE ${table} (id text, data jsonb, hash text)`);
        console.log(`Table ${table} created`);
    }
}

tables.map(createTable);

var base = new Airtable({ apiKey: 'keymYek7PsWGf6j7i' }).base('appi7MJY9TJIqNNJj');

function syncTable(table) {
    const allValues = [];
    base(table).select({}).eachPage(function page(records, fetchNextPage) {
        records.forEach(function (record) {
            allValues.push({ id: record.id, fields: record.fields, hash: hash(record.fields) });
        });
        fetchNextPage();
    }, async function done(error) {
        const currentState = (await pool.query(`SELECT id,hash FROM Property`)).rows;
        const added = _.differenceBy(allValues, currentState, 'id');
        const deleted = _.differenceBy(currentState, allValues, 'id');
        const changed = _(allValues)
            .differenceBy(added, 'id')
            .differenceBy(deleted, 'id')
            .differenceBy(currentState, 'hash')
            .value();

        added.forEach((record) => pool.query(`INSERT INTO Property VALUES ($1,$2,$3)`, [record.id, record.fields, record.hash]))
        deleted.forEach(({ id }) => pool.query(`DELETE FROM Property WHERE id = $1`, [id]));
        changed.forEach(record => pool.query(`UPDATE Property SET data=$1, hash=$2 WHERE id = $3`, [record.fields, record.hash, record.id]))

        console.log(error);
    });
}

syncTable('Property');
