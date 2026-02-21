import { DynoQuery } from "./index";
import { Model } from "./model";
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
    constructor(db: DynoQuery, config: PartitionConfig, id?: string);
    /**
     * Fetches all items in the partition and caches them.
     * Returns the data and caches it.
     */
    getAll<T = any>(): Promise<T[]>;
    /**
     * Get a model instance for a specific SK within this partition.
     */
    model<T = any>(sk: string): Model<T>;
    getPkValue(): string;
    /**
     * Generates items for batch query.
     * If no SKs are provided, it might not be very useful for batchGet (which requires full keys),
     * but the requirement says "will get all by pkValue" if no sk defined.
     * Actually, BatchGetItem requires both PK and SK if the table has both.
     * If it's for IndexQuery, it might be different.
     */
    batchGetInput(...sks: string[]): any[];
    /**
     * Generates items for batch write (put).
     */
    batchWriteInput(...items: any[]): any[];
    /**
     * Generates items for batch delete.
     */
    batchDeleteInput(...sks: string[]): any[];
    /**
     * Create an item in this partition and return the model.
     */
    create<T = any>(sk: string, data: T): Promise<Model<T>>;
    /**
     * Get data for a specific SK within this partition.
     * If the partition is loaded, it returns from cache.
     * Otherwise, it fetches the data immediately.
     */
    get<T = any>(sk: string): Promise<T | null>;
    /**
     * Delete all data in this partition.
     */
    deleteAll(): Promise<void>;
}
