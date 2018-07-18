const esprima = require('esprima');
const Airtable = require('airtable');
const hash = require('object-hash');
const { Pool, Client } = require('pg');
const _ = require('lodash');

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

const formattedDate = "date";
const tree = esprima.parseScript(`AND(OR(IS_BEFORE('${formattedDate}', AvailableFrom), IS_SAME('${formattedDate}', AvailableFrom)))`);

function formulaToSql({ type, body, callee, arguments, name, raw, expression }) {
    switch (type) {
        case 'Program':
            return formulaToSql(_.last(body));
        case 'ExpressionStatement':
            return formulaToSql(expression);
        case 'CallExpression':
            const sqlArguments = _.map(arguments, formulaToSql);
            switch (callee.name) {
                case 'AND':
                    return `(${sqlArguments.join(' AND ')})`;
                case 'OR':
                    return `(${sqlArguments.join(' OR ')})`;
                case 'IF':
                    return `CASE (${sqlArguments[0]}) 
                            WHEN TRUE THEN (${sqlArguments[1]})
                            ${sqlArguments[2] ? `ELSE (${sqlArguments[2]})` : ''}
                            END`
                default:
                    return `(${callee.name}(${sqlArguments.join(',')}))`;
            }
        case 'Identifier':
            return `data->>'${name}'`;
        case 'Literal':
            return raw;
    }
}

console.log(formulaToSql(tree));