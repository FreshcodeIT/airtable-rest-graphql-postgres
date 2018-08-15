let chai = require('chai');
let _ = require('lodash');
let Airtable = require('airtable');
let config = require('../config/test');
let {getEntitiesCount} = require('./utils');

let { server } = require('./rest');
server.listen(5000);

let base = new Airtable({ apiKey: config.apiKey, endpointUrl: 'http://localhost:5000' }).base(config.base);

describe.only('Paging offset API', function () {
    this.timeout(5000);
    describe('/GET list of all properties', () => {
        it('it should get each page from the list', (done) => {
            const pages = [];
            base('Property').select({pageSize:3, maxRecords:100}).eachPage((records, next) => {
                pages.push(_.map(records, 'fields.Name'));
                next();
            }, async () => {
                const dbCount = await getEntitiesCount('target.Property');
                chai.expect(pages.length).to.be.greaterThan(1);
                chai.expect(_.every(pages, (p) => p.length<=3)).to.be.true;
                chai.expect(_.uniq(_.flatten(pages)).length).to.be.equal(dbCount);
                done();
            });
        });
    });
});