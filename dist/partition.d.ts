import { DynoQuery } from "./index";
import { IndexQuery } from "./index-query";
export interface PartitionConfig {
    tableName?: string;
    pk?: string;
    pkPrefix?: string;
}
export declare class Partition {
    protected db: DynoQuery;
    protected tableName?: string;
    protected pkValue: string;
    protected pkName: string;
    protected skName: string;
    protected cache: Record<string, any>;
    protected isLoaded: boolean;
    protected lastEvaluatedKey: any;
    constructor(db: DynoQuery, config: PartitionConfig, id?: string);
    /**
     * Fetches all items in the partition and caches them.
     * Returns the data and caches it.
     */
    getAll<T = any>(options?: {
        limit?: number;
        exclusiveStartKey?: any;
        filterExpression?: string;
        expressionAttributeNames?: Record<string, string>;
        expressionAttributeValues?: Record<string, any>;
    }): Promise<T[]>;
    /**
     * Create an item in this partition.
     */
    create<T = any>(sk: string, data: T, indices?: IndexQuery[]): Promise<void>;
    /**
     * Update an existing item in this partition.
     */
    update<T = any>(sk: string, data: Partial<T>): Promise<void>;
    /**
     * Delete an item by its SK within this partition.
     */
    delete(sk: string): Promise<void>;
    /**
     * Get data for a specific SK within this partition.
     * If the partition is loaded, it returns from cache.
     * Otherwise, it fetches the data immediately.
     */
    get<T = any>(sk: string): Promise<T | null>;
    getPkValue(): string;
    getLastEvaluatedKey(): any;
    /**
     * Delete all data in this partition.
     */
    deleteAll(): Promise<void>;
}
