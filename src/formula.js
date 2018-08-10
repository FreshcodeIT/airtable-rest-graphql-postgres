const _ = require('lodash');
const peg = require("pegjs");
const fs = require('fs');

const parser = peg.generate(fs.readFileSync('./src/airtable.peg', 'utf8'), {cache: true});

// TODO : allow only Aritable functions(can check by requesting list of functions from schema)

function treeToSql({ binop, fun, args, left, right, variable, str, num, opType, resType }) {
    if (fun) {
        const sqlArguments = _.map(args, treeToSql);
        switch (fun) {
            case 'and':
                return `(${sqlArguments.join(' AND ')})`;
            case 'or':
                return `(${sqlArguments.join(' OR ')})`;
            case 'record_id':
                return `id`;
            case 'if':
                return `CASE (${sqlArguments[0]}) 
                    WHEN TRUE THEN (${sqlArguments[1]})
                    ${sqlArguments[2] ? `ELSE (${sqlArguments[2]})` : ''}
                    END`
            default:
                return `(${fun}(${sqlArguments.join(',')}))`;
        }
    }
    else if (binop) {
        const sqlOp = binop == '&' ? '||' : binop;
        return `((${treeToSql(left)}) ${sqlOp} (${treeToSql(right)}))`;
    }
    else if (variable) {
        return `fields->'${variable}'`;
    }
    else if (str) {
        return `'${str}'`;
    }
    else if (num) {
        return num;
    }
}

function formulaToSql(formula) {
    if (formula) {
        console.log("Formula:" + formula);
        console.time("parseTime");
        const parsedTree = parser.parse(formula.trim());
        console.timeEnd("parseTime");
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