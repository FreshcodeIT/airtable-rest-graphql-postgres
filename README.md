
Don't forget to set env variable for postgres database 

```DATABASE_URL=postgres://airtable@postgres/airtable npm start```

or in docker-compose.yml

```javascript
let airql = require('airtable-postgres-graphql');
let app = express();

const baseId = 'some base id';
const apiKey = 'some api key';

let {router, airtable} = airql.airtableRestRouter({apiKey: apiKey, base: baseId, tables: ['Property', 'Feature']});
airtable.setupPeriodicUpdate();

app.use(`/v0/${baseId}`, router); // for drop-in replacement usage with Airtable.js, just change host

airtable.onChange((event, entity) => {
    switch(event){
        case 'insert':
            return;
        case 'update':
            return;
        case 'delete':
            return;
    }
});

airtable.onSelect((user, entity) => {
    // user select info about himself
    if (user.airtableId === entity.id)
        return entity;
    switch(entity.__type) {
        // don't return personal information, prefer Whitelist approach because field names in Airtable can be easily changed
        case 'Landlord':
            return _.pick(entity, ['Name', 'Type']);
        case 'Agent':
            return _.pick(entity, ['Name', 'MobilePhone']);
    }
});
```

# Benchmarks

# Roadmap