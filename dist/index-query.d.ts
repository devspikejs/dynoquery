import { DynoQuery } from "./index";
export interface IndexQueryConfig {
    tableName?: string;
    indexName: string;
    pkName?: string;
    skName?: string;
    pkPrefix?: string;
    pkValue: string;
}
export declare class IndexQuery {
    protected db: DynoQuery;
    protected tableName: string;
    protected indexName: string;
    protected pkName: string;
    protected skName: string;
    protected pkValue: string;
    constructor(db: DynoQuery, config: IndexQueryConfig);
    get<T = any>(skValueOrOptions?: string | {
        skValue?: string;
        limit?: number;
        scanIndexForward?: boolean;
    }): Promise<T[]>;
    getAll<T = any>(): Promise<T[]>;
    getPkValue(): string;
    private mapItemToModel;
}
