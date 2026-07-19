import { DynoQuery } from "./index";
import { IndexQuery } from "./index-query";
import { ExpressionBuilder } from "./expression-builder";
export interface PartitionConfig {
    tableName?: string;
    pk?: string;
    pkPrefix?: string;
}
export declare class Item {
    [key: string]: any;
    private _indices;
    private _partition;
    private _skValue;
    private _toBeDeleted;
    private _updateParams?;
    private _filterBuilder?;
    private _conditionBuilder?;
    constructor(partition: Partition, skValue: string, data: any);
}
export declare class Partition {
    protected db: DynoQuery;
    protected tableName?: string;
    protected pkValue: string;
    protected pkName: string;
    protected skName: string;
    protected cache: Record<string, any>;
    protected isLoaded: boolean;
    protected LastEvaluatedKey: any;
    protected ttlAttributeName?: string;
    constructor(db: DynoQuery, config: PartitionConfig, id?: string);
    /**
     * Fetches all items in the partition and caches them.
     * Returns the data and caches it.
     */
    getAll<T = any>(options?: {
        Limit?: number;
        ExclusiveStartKey?: any;
        filterBuilder?: ExpressionBuilder;
        FilterExpression?: string;
        ProjectionExpression?: string;
        ExpressionAttributeNames?: Record<string, string>;
        ExpressionAttributeValues?: Record<string, any>;
    }): Promise<T[]>;
    /**
     * Create an item in this partition.
     */
    create<T = any>(skValue: string, data: T, indices?: IndexQuery[], options?: {
        conditionBuilder?: ExpressionBuilder;
        ConditionExpression?: string;
        ExpressionAttributeNames?: Record<string, string>;
        ExpressionAttributeValues?: Record<string, any>;
    }): Promise<T>;
    /**
     * Internal method to get raw data for a specific SK.
     */
    private _getRaw;
    /**
     * Update an existing item in this partition.
     */
    update<T = any>(skValue: string, data: Partial<T>, indices?: IndexQuery[], options?: {
        conditionBuilder?: ExpressionBuilder;
        ConditionExpression?: string;
        ExpressionAttributeNames?: Record<string, string>;
        ExpressionAttributeValues?: Record<string, any>;
    }): Promise<T>;
    /**
     * Update an item using raw update parameters (UpdateExpression).
     */
    updateRaw(skValue: string, params: {
        UpdateExpression: string;
        ExpressionAttributeNames?: Record<string, string>;
        ExpressionAttributeValues?: Record<string, any>;
    }, options?: {
        conditionBuilder?: ExpressionBuilder;
    }): Promise<void>;
    /**
     * Delete an item by its SK within this partition.
     */
    delete(skValue: string, options?: {
        conditionBuilder?: ExpressionBuilder;
        ConditionExpression?: string;
        ExpressionAttributeNames?: Record<string, string>;
        ExpressionAttributeValues?: Record<string, any>;
    }): Promise<void>;
    /**
     * Get data for a specific SK and return it wrapped in a Item object.
     */
    get<T = any>(skValue: string): Promise<T | null>;
    /**
     * Pre-draft an item for creation. Returns an Item object.
     * @param skValue The sort key value
     * @param data Initial data for the row
     */
    draft<T = any>(skValue: string, data?: any): T;
    /**
     * Pre-draft an item for deletion. Returns an Item object marked for deletion.
     * @param skValue The sort key value
     */
    draftDelete<T = any>(skValue: string): T;
    getTableName(): string;
    getPkValue(): string;
    getTtlAttributeName(): string | undefined;
    getLastEvaluatedKey(): any;
    /**
     * Delete all data in this partition.
     */
    deleteAll(): Promise<void>;
}
