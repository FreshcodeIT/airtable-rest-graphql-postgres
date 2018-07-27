let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let morgan = require('morgan');

let {listRecords, createRecord, retrieveRecord, deleteRecord, updateRecord} = require('../src/actions');

app.use(morgan('combined'));
app.use(bodyParser.json());                                     
app.use(bodyParser.urlencoded({extended: true}));               
app.use(bodyParser.text());                                    
app.use(bodyParser.json({ type: 'application/json'}));  

app.route("/:table")
    .get(listRecords)
    .post(createRecord);
app.route("/:table/:id")
    .get(retrieveRecord)
    .delete(deleteRecord)
    .patch(updateRecord);

module.exports = app; 