"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpressionBuilder = void 0;
exports.attr = attr;
class ExpressionBuilder {
    constructor() {
        this.parts = [];
        this.attributeNames = {};
        this.attributeValues = {};
        this.valueCounter = 0;
        this.nameCounter = 0;
    }
    static field(name) {
        const builder = new ExpressionBuilder();
        builder.parts.push({ type: 'field', name });
        return builder;
    }
    static value(val) {
        const builder = new ExpressionBuilder();
        builder.parts.push({ type: 'value', value: val });
        return builder;
    }
    where(field, operator, value) {
        this.parts.push({ type: 'condition', field, operator, value });
        return this;
    }
    equals(value) {
        this.parts.push({ type: 'operator', operator: '=', value });
        return this;
    }
    notEquals(value) {
        this.parts.push({ type: 'operator', operator: '<>', value });
        return this;
    }
    lessThan(value) {
        this.parts.push({ type: 'operator', operator: '<', value });
        return this;
    }
    lessThanOrEqual(value) {
        this.parts.push({ type: 'operator', operator: '<=', value });
        return this;
    }
    greaterThan(value) {
        this.parts.push({ type: 'operator', operator: '>', value });
        return this;
    }
    greaterThanOrEqual(value) {
        this.parts.push({ type: 'operator', operator: '>=', value });
        return this;
    }
    between(start, end) {
        this.parts.push({ type: 'between', start, end });
        return this;
    }
    in(values) {
        this.parts.push({ type: 'in', values });
        return this;
    }
    exists() {
        const last = this.parts.pop();
        if (last && last.type === 'field') {
            this.parts.push({ type: 'function', name: 'attribute_exists', args: [last] });
        }
        return this;
    }
    notExists() {
        const last = this.parts.pop();
        if (last && last.type === 'field') {
            this.parts.push({ type: 'function', name: 'attribute_not_exists', args: [last] });
        }
        return this;
    }
    type(type) {
        const last = this.parts.pop();
        if (last && last.type === 'field') {
            this.parts.push({ type: 'function', name: 'attribute_type', args: [last, { type: 'value', value: type }] });
        }
        return this;
    }
    attributeExists(path) {
        this.parts.push({ type: 'function', name: 'attribute_exists', args: [{ type: 'field', name: path }] });
        return this;
    }
    attributeNotExists(path) {
        this.parts.push({ type: 'function', name: 'attribute_not_exists', args: [{ type: 'field', name: path }] });
        return this;
    }
    attributeType(path, type) {
        this.parts.push({ type: 'function', name: 'attribute_type', args: [{ type: 'field', name: path }, { type: 'value', value: type }] });
        return this;
    }
    beginsWith(pathOrSubstr, substr) {
        if (substr !== undefined) {
            // Legacy static-like call: builder.beginsWith('field', 'prefix')
            this.parts.push({ type: 'function', name: 'begins_with', args: [{ type: 'field', name: pathOrSubstr }, { type: 'value', value: substr }] });
        }
        else {
            // Fluent call: attr('field').beginsWith('prefix')
            const last = this.parts.pop();
            if (last && last.type === 'field') {
                this.parts.push({ type: 'function', name: 'begins_with', args: [last, { type: 'value', value: pathOrSubstr }] });
            }
        }
        return this;
    }
    contains(pathOrValue, value) {
        if (value !== undefined) {
            // Legacy static-like call: builder.contains('field', 'value')
            this.parts.push({ type: 'function', name: 'contains', args: [{ type: 'field', name: pathOrValue }, { type: 'value', value }] });
        }
        else {
            // Fluent call: attr('field').contains('value')
            const last = this.parts.pop();
            if (last && last.type === 'field') {
                this.parts.push({ type: 'function', name: 'contains', args: [last, { type: 'value', value: pathOrValue }] });
            }
        }
        return this;
    }
    size(path) {
        if (path) {
            // Legacy: builder.size('field')
            const builder = new ExpressionBuilder();
            builder.parts.push({ type: 'function', name: 'size', args: [{ type: 'field', name: path }] });
            return builder;
        }
        else {
            // Fluent: attr('field').size()
            const last = this.parts.pop();
            if (last && last.type === 'field') {
                this.parts.push({ type: 'function', name: 'size', args: [last] });
            }
            return this;
        }
    }
    and(other) {
        const newBuilder = new ExpressionBuilder();
        newBuilder.parts.push({ type: 'group', builder: this });
        newBuilder.parts.push({ type: 'logical', operator: 'AND' });
        newBuilder.parts.push({ type: 'group', builder: other });
        return newBuilder;
    }
    or(other) {
        const newBuilder = new ExpressionBuilder();
        newBuilder.parts.push({ type: 'group', builder: this });
        newBuilder.parts.push({ type: 'logical', operator: 'OR' });
        newBuilder.parts.push({ type: 'group', builder: other });
        return newBuilder;
    }
    static not(condition) {
        const builder = new ExpressionBuilder();
        builder.parts.push({ type: 'logical', operator: 'NOT' });
        builder.parts.push({ type: 'group', builder: condition });
        return builder;
    }
    build(attributeNames = {}, attributeValues = {}, counters = { name: 0, value: 0 }) {
        let expressionParts = [];
        for (const part of this.parts) {
            switch (part.type) {
                case 'field': {
                    const namePlaceholder = `#n${counters.name++}`;
                    attributeNames[namePlaceholder] = part.name;
                    expressionParts.push(namePlaceholder);
                    break;
                }
                case 'value': {
                    const valuePlaceholder = `:v${counters.value++}`;
                    attributeValues[valuePlaceholder] = part.value;
                    expressionParts.push(valuePlaceholder);
                    break;
                }
                case 'condition': {
                    const namePlaceholder = `#n${counters.name++}`;
                    attributeNames[namePlaceholder] = part.field;
                    const valuePlaceholder = `:v${counters.value++}`;
                    attributeValues[valuePlaceholder] = part.value;
                    expressionParts.push(`${namePlaceholder} ${part.operator} ${valuePlaceholder}`);
                    break;
                }
                case 'operator': {
                    const valuePlaceholder = `:v${counters.value++}`;
                    attributeValues[valuePlaceholder] = part.value;
                    const last = expressionParts.pop();
                    expressionParts.push(`${last} ${part.operator} ${valuePlaceholder}`);
                    break;
                }
                case 'between': {
                    const startPlaceholder = `:v${counters.value++}`;
                    attributeValues[startPlaceholder] = part.start;
                    const endPlaceholder = `:v${counters.value++}`;
                    attributeValues[endPlaceholder] = part.end;
                    const last = expressionParts.pop();
                    expressionParts.push(`${last} BETWEEN ${startPlaceholder} AND ${endPlaceholder}`);
                    break;
                }
                case 'in': {
                    const placeholders = part.values.map((v) => {
                        const vp = `:v${counters.value++}`;
                        attributeValues[vp] = v;
                        return vp;
                    });
                    const last = expressionParts.pop();
                    expressionParts.push(`${last} IN (${placeholders.join(', ')})`);
                    break;
                }
                case 'function': {
                    const args = part.args.map((arg) => {
                        if (arg.type === 'field') {
                            const np = `#n${counters.name++}`;
                            attributeNames[np] = arg.name;
                            return np;
                        }
                        else if (arg.type === 'value') {
                            const vp = `:v${counters.value++}`;
                            attributeValues[vp] = arg.value;
                            return vp;
                        }
                        else if (arg instanceof ExpressionBuilder) {
                            const sub = arg.build(attributeNames, attributeValues, counters);
                            return sub.expression;
                        }
                        return arg;
                    });
                    expressionParts.push(`${part.name}(${args.join(', ')})`);
                    break;
                }
                case 'logical': {
                    expressionParts.push(part.operator);
                    break;
                }
                case 'group': {
                    const sub = part.builder.build(attributeNames, attributeValues, counters);
                    expressionParts.push(`(${sub.expression})`);
                    break;
                }
            }
        }
        return {
            expression: expressionParts.join(' '),
            attributeNames,
            attributeValues
        };
    }
}
exports.ExpressionBuilder = ExpressionBuilder;
function attr(name) {
    return ExpressionBuilder.field(name);
}
