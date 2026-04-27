export type Operand = string | number | ExpressionBuilder;
export declare class ExpressionBuilder {
    private parts;
    private attributeNames;
    private attributeValues;
    private valueCounter;
    private nameCounter;
    constructor();
    static field(name: string): ExpressionBuilder;
    static value(val: any): ExpressionBuilder;
    where(field: string, operator: string, value: any): ExpressionBuilder;
    equals(value: any): ExpressionBuilder;
    notEquals(value: any): ExpressionBuilder;
    lessThan(value: any): ExpressionBuilder;
    lessThanOrEqual(value: any): ExpressionBuilder;
    greaterThan(value: any): ExpressionBuilder;
    greaterThanOrEqual(value: any): ExpressionBuilder;
    between(start: any, end: any): ExpressionBuilder;
    in(values: any[]): ExpressionBuilder;
    exists(): ExpressionBuilder;
    notExists(): ExpressionBuilder;
    type(type: string): ExpressionBuilder;
    attributeExists(path: string): ExpressionBuilder;
    attributeNotExists(path: string): ExpressionBuilder;
    attributeType(path: string, type: string): ExpressionBuilder;
    beginsWith(pathOrSubstr: string, substr?: string): ExpressionBuilder;
    contains(pathOrValue: string, value?: any): ExpressionBuilder;
    size(path?: string): ExpressionBuilder;
    and(other: ExpressionBuilder): ExpressionBuilder;
    or(other: ExpressionBuilder): ExpressionBuilder;
    static not(condition: ExpressionBuilder): ExpressionBuilder;
    build(attributeNames?: Record<string, string>, attributeValues?: Record<string, any>, counters?: {
        name: number;
        value: number;
    }): {
        expression: string;
        attributeNames: Record<string, string>;
        attributeValues: Record<string, any>;
    };
}
export declare function attr(name: string): ExpressionBuilder;
