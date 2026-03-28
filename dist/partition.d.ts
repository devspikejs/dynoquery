import { DynoQuery } from "./index";
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
     * Create an item in this partition.
     */
    create<T = any>(sk: string, data: T): Promise<void>;
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
     * Delete all data in this partition.
     */
    deleteAll(): Promise<void>;
}
