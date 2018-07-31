```javascript
let airql = require('airtable-postgres-graphql');
let app = express();

app.use('/airtable', airql.airtableRestRouter({apiKey: '..', base: '..', tables: ['Property', 'Feature']}));
airql.onChange((event, entity) => {
    switch(event){
        case 'insert':
            return;
        case 'update':
            return;
        case 'delete':
            return;
    }
})
```
 