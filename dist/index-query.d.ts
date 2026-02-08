import { DynoQuery } from "./index";
export interface IndexQueryConfig {
    tableName?: string;
    indexName: string;
    pkName?: string;
    skName?: string;
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
    query<T = any>(options?: {
        skValue?: string;
        limit?: number;
        scanIndexForward?: boolean;
    }): Promise<T[]>;
    private mapItemToModel;
}
