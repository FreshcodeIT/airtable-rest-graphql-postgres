let chai = require('chai');
let sinon = require('sinon');
let _ = require('lodash');

let { server, airtable } = require('./rest');
let { clearPostgresTable, getEntitiesAsMap } = require('./utils');

describe('Hooks', function () {
    this.timeout(5000);
    before(async () => {
        await clearPostgresTable('Property');
        await airtable.setupPeriodicUpdate();
    });

    beforeEach(() => {
        airtable.onChangeHooks.length = 0;
    })

    describe('/POST New property', () => {
        it('it should call onChange hook', async () => {
            const callbackSpy = sinon.spy();
            airtable.onChange(callbackSpy);
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
            await chai.request(server).post('/Property').send(property);
            chai.assert(callbackSpy.calledOnce);
            chai.assert(callbackSpy.calledWith('Property', 'insert', {}, sinon.match(property)));
        });
    });

    describe('/PATCH/:id property', async () => {
        it('hook with update should be called', async () => {
            const callbackSpy = sinon.spy();
            airtable.onChange(callbackSpy);

            const id = _.entries((await getEntitiesAsMap('target.Property', 'Name')))[0][1];

            const oldValue = (await chai.request(server).get(`/Property/${id}`)).body;
            const newProps = { fields: { Name: ("New name " + new Date().getTime()) } };

            await chai.request(server).patch(`/Property/${id}`).send(newProps);

            chai.assert(callbackSpy.calledOnce);
            chai.assert(callbackSpy.calledWith('Property', 'update', sinon.match.has('fields',sinon.match(oldValue.fields)), sinon.match.has('fields', sinon.match(_.assign({}, oldValue.fields, newProps.fields)))));
        });
    });

});