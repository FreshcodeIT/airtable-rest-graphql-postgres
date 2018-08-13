let chai = require('chai');

let { server, airtable } = require('./rest');
let { clearPostgresTable, selectAndCompareLocalAndRemote, getEntitiesAsMap } = require('./utils');

function checkEqual(filter, maxRecords) {
    return selectAndCompareLocalAndRemote(server, `/Property?maxRecords=${maxRecords || 100}&view=Grid%20view&filterByFormula=${encodeURIComponent(filter)}&sort[0][field]=Name&sort[0][direction]=asc`);
}

// TODO : use Airtable.js with custom endpoint
// You can use https://codepen.io/airtable/full/rLKkYB to create proper Airtable API URL
describe('Properties', function () {
    this.timeout(5000);
    before(async () => {
        // TODO make sure that state before each test remains the same(sync, restore from db, rollback transaction)
        await clearPostgresTable('Property');
        await airtable.setupPeriodicUpdate();
    });

    describe('/GET All Properties', () => {
        it('it should GET all the Properties', () => {
            return checkEqual(`AND(FIND('London',  ARRAYJOIN(CityLookup, ';')))`);
        });
    });
    describe('/GET All Properties with Space in Field name', () => {
        it('it should GET all the Properties', () => {
            return checkEqual(`{Single select}='yes'`);
        });
    });
    describe('/GET All Properties with complex formula', () => {
        it('it should GET all the Properties', () => {
            return checkEqual(`AND(AND(IF({Extra price(rollup)}>=5,TRUE()),IF({Extra price(rollup)}<=18, TRUE())))`);
        });
    });
    describe('/GET All Properties with access to Lookup field', () => {
        it('it should GET all the Properties', () => {
            return checkEqual(`{City name field}='London,Manchester'`);
        });
    }); 
    describe('/GET All Properties with access to Lookup field', () => {
        it('it should GET all the Properties', () => {
            return checkEqual(`'London,Manchester'={City name field}`);
        });
    });
    describe('/GET All Properties Greater or equals', () => {
        it('it should GET all the Properties', () => {
            return checkEqual(`{Extra price(rollup)}>=10`);
        });
    });
    describe('/GET complex AND formula', () => {
        it('it should get by complex AND formula', () => {
            return checkEqual(`{Extra price(rollup)}>=10`);
        })
    } )
    describe('/POST New property', () => {
        it('it should Post property which should arrive both in local and remote repository', async () => {
            const cities = await getEntitiesAsMap('target.City_name', 'Name');
            const features = await getEntitiesAsMap('target.Feature', 'Name');
            let property = {
                fields: {
                    "Name": "Some property",
                    "City": [
                        cities.London
                    ],
                    "Features": [
                        features.Gym,
                        features.Lounge
                    ],
                    "Date": "2018-07-11",
                    "Single select": "yes"
                }
            };
            const result = await chai.request(server).post('/Property').send(property);
            return checkEqual(`RECORD_ID()='${result.body.id}'`);
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
    describe('/PATCH/:id property', async () => {
        const newName = "The Chronicles of Narnia" + (new Date());

        it('change Property name and City(CityLookup also should change)', async () => {
            const cities = await getEntitiesAsMap('target.City_name', 'Name');
            const id = (await getEntitiesAsMap('target.Property', 'Name'))['21 Liverpool Street, London, UK'];

            await chai.request(server).patch(`/Property/${id}`).send({ fields: { Name: newName, City: [cities.Zaporozhye] } });
            const [localZp] = await checkEqual(`RECORD_ID()='${id}'`);
            chai.expect(localZp.body.records[0].fields.Name == newName).to.be.true;
            chai.expect(localZp.body.records[0].fields.CityLookup[0] == 'Zaporozhye').to.be.true;
        });

        it('Change City one more time to ensure that Lookup field is also changed', async () => {
            const cities = await getEntitiesAsMap('target.City_name', 'Name');
            const id = (await getEntitiesAsMap('target.Property', 'Name'))[newName];

            await chai.request(server).patch(`/Property/${id}`).send({ fields: { City: [cities.London] } });
            const [localLondon] = await checkEqual(`RECORD_ID()='${id}'`);
            chai.expect(localLondon.body.records[0].fields.CityLookup[0] == 'London').to.be.true;
        });
    });

    describe('/GET All Properties', () => {
        it('After all changes and updates - lists should be qeual', () => {
            return selectAndCompareLocalAndRemote(server, `/Property?maxRecords=100&view=Grid%20view`);
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