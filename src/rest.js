let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let port = 8080;
let {listRecords, createRecord, retrieveRecord, deleteRecord, updateRecord} = require('./actions');

app.use(bodyParser.json());                                     
app.use(bodyParser.urlencoded({extended: true}));               
app.use(bodyParser.text());                                    
app.use(bodyParser.json({ type: 'application/json'}));  

app.get("/", (req, res) => res.json({message: "Welcome to our Bookstore!"}));

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