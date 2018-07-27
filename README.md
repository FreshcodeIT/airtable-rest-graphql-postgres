```javascript
let airql = require('airtable-postgres-graphql');
let app = express();

airql.setupAirtableRest(app);
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
 