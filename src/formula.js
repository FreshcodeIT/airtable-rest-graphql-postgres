const _ = require('lodash');
const peg = require("pegjs");
const fs = require('fs');

const parser = peg.generate(fs.readFileSync('./src/airtable.peg', 'utf8'), { cache: true });

// TODO : allow only Aritable functions(can check by requesting list of functions from schema)

function treeToSql({ binop, fun, args, left, right, variable, str, num, type }) {
    if (fun) {
        const sqlArguments = _.map(args, treeToSql);
        switch (fun) {
            case 'and':
                return `(${sqlArguments.map(arg => `${arg}::boolean`).join(' AND ')})`;
            case 'or':
                return `(${sqlArguments.map(arg => `${arg}::boolean`).join(' OR ')})`;
            case 'true':
                return `true`;
            case 'false':
                return `false`;
            case 'record_id':
                return `id`;
            case 'if':
                return `CASE (${sqlArguments[0]}::boolean) 
                    WHEN TRUE THEN (${sqlArguments[1]})
                    ${sqlArguments[2] ? `ELSE (${sqlArguments[2]})` : ''}
                    END`
            default:
                return `(${fun}(${sqlArguments.join(',')}))`;
        }
    }
    else if (binop) {
        if (type === 'str') {
            return `((${treeToSql(left)}) || (${treeToSql(right)}))`;
        }
        else {
            return `JSON_BINOP('${type}','${binop}',${treeToSql(left)}::text, ${treeToSql(right)}::text)`
        }
    }
    else if (variable) {
        return `fields->>'${variable}'`;
    }
    else if (str) {
        return `'${str}'::text`;
    }
    else if (num) {
        return num;
    }
}

function formulaToSql(formula) {
    if (formula) {
        console.log("Formula:" + formula);
        const parsedTree = parser.parse(formula.trim());
        return `${treeToSql(parsedTree)}::boolean`;
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


