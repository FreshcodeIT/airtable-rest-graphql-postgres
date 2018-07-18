const esprima = require('esprima');

// TODO : allow only Aritable functions(can check by requesting list of functions from schema)

function formulaToSql({ type, body, callee, arguments, name, raw, expression }) {
    switch (type) {
        case 'Program':
            return formulaToSql(_.last(body));
        case 'ExpressionStatement':
            return formulaToSql(expression);
        case 'CallExpression':
            const sqlArguments = _.map(arguments, formulaToSql);
            switch (callee.name) {
                case 'AND':
                    return `(${sqlArguments.join(' AND ')})`;
                case 'OR':
                    return `(${sqlArguments.join(' OR ')})`;
                case 'IF':
                    return `CASE (${sqlArguments[0]}) 
                            WHEN TRUE THEN (${sqlArguments[1]})
                            ${sqlArguments[2] ? `ELSE (${sqlArguments[2]})` : ''}
                            END`
                default:
                    return `(${callee.name}(${sqlArguments.join(',')}))`;
            }
        case 'Identifier':
            return `data->>'${name}'`;
        case 'Literal':
            return raw;
    }
}
