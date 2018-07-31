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

app.use('/', airql.airtableRestRouter(require('../config/test')));

module.exports = app; 