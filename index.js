let { listRecords, createRecord, retrieveRecord, deleteRecord, updateRecord } = require('./src/actions');

function setupAirtableRest(app) {
    app.route("/:table")
        .get(listRecords)
        .post(createRecord);
    app.route("/:table/:id")
        .get(retrieveRecord)
        .delete(deleteRecord)
        .patch(updateRecord);
    return app;
}

function onChangeHook(hook) {

}

module.exports = { setupAirtableRest, onChangeHook };