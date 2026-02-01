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
    protected pk: string;
    protected cache: Record<string, any>;
    protected isLoaded: boolean;
    constructor(db: DynoQuery, config: PartitionConfig, id?: string);
    /**
     * Load all data for this partition key.
     */
    load(): Promise<this>;
    /**
     * Get a model instance for a specific SK within this partition.
     */
    model<T = any>(sk: string): Model<T>;
    getPK(): string;
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
}
