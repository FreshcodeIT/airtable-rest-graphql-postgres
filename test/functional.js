let chai = require('chai');
let chaiHttp = require('chai-http');
let server = require('../src/rest');
let config = require('config');
let sync = require('../src/sync');
let should = chai.should();
let _ = require('lodash');

chai.use(chaiHttp);

// TODO : use Airtable.js with custom endpoint
// You can use https://codepen.io/airtable/full/rLKkYB to create proper Airtable API URL
function selectAndCompareLocalAndRemote(url) {
    return Promise
        .all([
            chai.request(server).get(url),
            chai.request(`https://api.airtable.com/v0/${config.get('airtable.base')}`).get(url).set('Authorization', 'Bearer keymYek7PsWGf6j7i')
        ])
        .then(([local, airtable]) => {
            local.body.records.should.be.deep.equal(airtable.body.records);
            chai.expect(local.body.records.length > 0).to.be.true;
            return [local, airtable];
        });
}

async function getSingleEntity(table, id) {
    const res = await chai.request(`https://api.airtable.com/v0/${config.get('airtable.base')}`).get(`/${table}/${id}`).set('Authorization', 'Bearer keymYek7PsWGf6j7i');
    return res.body;
}

describe('Properties', function () {
    this.timeout(5000);
    before(async () => {
        // TODO make sure that state before each test remains the same(sync, restore from db, rollback transaction)
        await sync.init();
        await sync.syncTableFromScratch('Property');
    });
    describe('/GET All Properties', () => {
        it('it should GET all the Properties', () => {
            return selectAndCompareLocalAndRemote(`/Property?maxRecords=3&view=Grid%20view&filterByFormula=AND(FIND('London',  ARRAYJOIN(CityLookup, ';')))&sort[0][field]=Created time&sort[0][direction]=asc`);
        });
    });
    describe('/POST New property', () => {
        it('it should Post property which should arrive both in local and remote repository', async () => {
            let property = {
                fields: {
                    "Name": "330 Euston Road, London, UK",
                    "Address": "330 Euston Road, London, UK",
                    "City": [
                        "rec15jNSgn0MUMNxZ"
                    ],
                    "Type": "Room in a flat share",
                    "NumberOfRooms": 5,
                    "Postcode": "NW1 3BD",
                    "Country": "United Kingdom",
                    "House Description": "sdfsgdfg",
                    "Communal Area description": "asdasd",
                    "Landlord": [
                        "recUgYptCwevSMb3M"
                    ],
                    "Rooms": [
                        "receYTXxx4ZGQEyqS"
                    ],
                    "Approve status": "to be approved"
                }
            };
            const result = await chai.request(server).post('/Property').send(property);
            return selectAndCompareLocalAndRemote(`/Property?maxRecords=3&filterByFormula=RECORD_ID()%3D'${result.body.id}'`);
        });
    });
    // describe('/GET/:id book', () => {
    //     it('it should GET a book by the given id', (done) => {
    //         let book = new Book({ title: "The Lord of the Rings", author: "J.R.R. Tolkien", year: 1954, pages: 1170 });
    //         book.save((err, book) => {
    //             chai.request(server)
    //                 .get('/book/' + book.id)
    //                 .send(book)
    //                 .end((err, res) => {
    //                     res.should.have.status(200);
    //                     res.body.should.be.a('object');
    //                     res.body.should.have.property('title');
    //                     res.body.should.have.property('author');
    //                     res.body.should.have.property('pages');
    //                     res.body.should.have.property('year');
    //                     res.body.should.have.property('_id').eql(book.id);
    //                     done();
    //                 });
    //         });

    //     });
    // });
    describe('/PATCH/:id property', () => {

        const newName = "The Chronicles of Narnia" + (new Date());
        const cities = { London: 'rec15jNSgn0MUMNxZ', Zaporozhye: 'recEu3Pa4VZ88nPKV' };
        const id = 'rectjYQmyIofRmQ8J';

        it('change Property name and City(CityLookup also should change)', async () => {
            await chai.request(server).patch(`/Property/${id}`).send({ fields: { Name: newName, City: [cities.Zaporozhye] } });
            const [localZp] = await selectAndCompareLocalAndRemote(`/Property?maxRecords=3&filterByFormula=RECORD_ID()%3D'${id}'`);
            chai.expect(localZp.body.records[0].fields.Name == newName).to.be.true;
            chai.expect(localZp.body.records[0].fields.CityLookup[0] == 'Zaporozhye').to.be.true;
        });

        it('Change City one more time to ensure that Lookup field is also changed', async () => {
            await chai.request(server).patch(`/Property/${id}`).send({ fields: { City: [cities.London] } });
            const [localLondon] = await selectAndCompareLocalAndRemote(`/Property?maxRecords=3&filterByFormula=RECORD_ID()%3D'${id}'`);
            chai.expect(localLondon.body.records[0].fields.CityLookup[0] == 'London').to.be.true;
        });
    });

    // describe('/DELETE/:id book', () => {
    //     it('it should DELETE a book given the id', (done) => {
    //         let book = new Book({ title: "The Chronicles of Narnia", author: "C.S. Lewis", year: 1948, pages: 778 })
    //         book.save((err, book) => {
    //             chai.request(server)
    //                 .delete('/book/' + book.id)
    //                 .end((err, res) => {
    //                     res.should.have.status(200);
    //                     res.body.should.be.a('object');
    //                     res.body.should.have.property('message').eql('Book successfully deleted!');
    //                     res.body.result.should.have.property('ok').eql(1);
    //                     res.body.result.should.have.property('n').eql(1);
    //                     done();
    //                 });
    //         });
    //     });
    // });
});