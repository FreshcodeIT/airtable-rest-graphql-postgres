let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let {listRecords, createRecord, retrieveRecord, deleteRecord, updateRecord} = require('./actions');
let morgan = require('morgan');

let port = 8080;

app.use(bodyParser.json());                                     
app.use(bodyParser.urlencoded({extended: true}));               
app.use(bodyParser.text());                                    
app.use(bodyParser.json({ type: 'application/json'}));  
app.use(morgan('combined'));

app.route("/:table")
    .get(listRecords)
    .post(createRecord);
app.route("/:table/:id")
    .get(retrieveRecord)
    .delete(deleteRecord)
    .patch(updateRecord);

app.listen(port);
console.log("Listening on port " + port);

module.exports = app; 