let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let morgan = require('morgan');
let airql = require('../index');

app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());
app.use(bodyParser.json({ type: 'application/json' }));

let {router, airtable} = airql.airtableRestRouter(require('../config/test'));

app.use('/v0/appi7MJY9TJIqNNJj', router);

module.exports = {server: app, airtable}; 