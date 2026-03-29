import { DynoQuery } from "./index";
export interface IndexQueryConfig {
    tableName?: string;
    indexName: string;
    pkName?: string;
    skName?: string;
    pkPrefix?: string;
    pkValue: string;
    skValue?: string;
}
export declare class IndexQuery {
    protected db: DynoQuery;
    protected tableName: string;
    protected indexName: string;
    protected pkName: string;
    protected skName: string;
    protected pkValue: string;
    protected skValue?: string;
    protected lastEvaluatedKey: any;
    constructor(db: DynoQuery, config: IndexQueryConfig);
    getAll<T = any>(options?: {
        limit?: number;
        scanIndexForward?: boolean;
        exclusiveStartKey?: any;
        skValue?: string;
    }): Promise<T[]>;
    get<T = any>(skValue?: string): Promise<T | null>;
    getPkValue(): string;
    getPkName(): string;
    getSkName(): string;
    getSkValue(): string | undefined;
    getLastEvaluatedKey(): any;
    private mapItemToModel;
}
