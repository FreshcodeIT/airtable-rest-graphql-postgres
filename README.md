```javascript
let airql = require('airtable-postgres-graphql');
let app = express();

let {router, airtable} = airql.airtableRestRouter({apiKey: '..', base: '..', tables: ['Property', 'Feature']})

app.use('/airtable', router);

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