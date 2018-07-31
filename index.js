let AirtableRest = require('./src/actions');
let express = require('express');

function airtableRestRouter(config) {
    let router = express.Router({ mergeParams: true });
    let airtable = new AirtableRest(config);
    router.route("/:table")
        .get(airtable.listRecords.bind(airtable))
        .post(airtable.createRecord.bind(airtable));
    router.route("/:table/:id")
        .get(airtable.retrieveRecord.bind(airtable))
        .delete(airtable.deleteRecord.bind(airtable))
        .patch(airtable.updateRecord.bind(airtable));
    return router;
}

function onChange(hook) {

}

module.exports = { airtableRestRouter, onChange };