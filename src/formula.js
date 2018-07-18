const esprima = require('esprima');
const _ = require('lodash');

// TODO : allow only Aritable functions(can check by requesting list of functions from schema)

function treeToSql({ type, body, callee, arguments, name, raw, expression }) {
    switch (type) {
        case 'Program':
            return treeToSql(_.last(body));
        case 'ExpressionStatement':
            return treeToSql(expression);
        case 'CallExpression':
            const sqlArguments = _.map(arguments, treeToSql);
            switch (callee.name) {
                case 'AND':
                    return `(${sqlArguments.join(' AND ')})`;
                case 'OR':
                    return `(${sqlArguments.join(' OR ')})`;
                case 'RECORD_ID':
                    return `id`;
                case 'IF':
                    return `CASE (${sqlArguments[0]}) 
                            WHEN TRUE THEN (${sqlArguments[1]})
                            ${sqlArguments[2] ? `ELSE (${sqlArguments[2]})` : ''}
                            END`
                default:
                    return `(${callee.name}(${sqlArguments.join(',')}))`;
            }
        case 'Identifier':
            return `data->'${name}'`;
        case 'Literal':
            return raw;
    }
}

function formulaToSql(formula) {
    if (formula)
        return `${treeToSql(esprima.parse(formula))}::boolean`;
    else
        return "TRUE";
}

module.exports = formulaToSql;