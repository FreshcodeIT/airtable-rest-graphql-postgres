const esprima = require('esprima');
const _ = require('lodash');

// TODO : allow only Aritable functions(can check by requesting list of functions from schema)

function treeToSql({ type, body, callee, arguments, name, raw, expression, operator, left, right, value}) {
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
        case 'BinaryExpression':
            switch (operator) {
                case '==':
                    return `((${treeToSql(left)})=(${treeToSql(right)}))`;
                default:
                    return `((${treeToSql(left)}) ${operator} (${treeToSql(right)}))`;
            }
            return;
        case 'Identifier':
            return `fields->>'${name}'`;
        case 'Literal':
            if (value.startsWith('={') && value.endsWith('}='))
                return `fields->>'${value.replace('={','').replace('}=','')}'`
            return raw;
    }
}

function formulaToSql(formula) {
    if (formula) {
        // TODO : create speicific parser for Airtable formulas
        formula = formula.replace('=', '==').replace('{','"={').replace('}','}="');
        console.log("Formula:" + formula);
        return `${treeToSql(esprima.parse(formula))}::boolean`;
    }
    else
        return "TRUE";
}

function sortToSql(fields) {
    // TODO : add validation by fields
    if (!fields || !fields.length)
        return "id";
    else
        return _.map(fields, ({ field, direction }) => `fields->'${field}' ${direction}`).join(',');
}

module.exports = { formulaToSql, sortToSql };