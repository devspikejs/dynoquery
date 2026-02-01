import { PutCommandInput, GetCommandInput, UpdateCommandInput, DeleteCommandInput, QueryCommandInput, ScanCommandInput, BatchGetCommandInput, BatchWriteCommandInput } from "@aws-sdk/lib-dynamodb";
export interface DynoQueryConfig {
    tableName?: string;
    region?: string;
    endpoint?: string;
    pkPrefix?: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    };
    partitions?: Record<string, {
        pkPrefix: string;
    }>;
}
export declare class DynoQuery {
    private client;
    private docClient;
    private defaultTableName?;
    private globalPkPrefix;
    [key: string]: any;
    constructor(config?: DynoQueryConfig);
    /**
     * Create or replace an item in the table.
     */
    create(params: PutCommandInput): Promise<import("@aws-sdk/lib-dynamodb").PutCommandOutput>;
    /**
     * Get an item by its primary key.
     */
    get(params: GetCommandInput): Promise<import("@aws-sdk/lib-dynamodb").GetCommandOutput>;
    /**
     * Update an existing item.
     */
    update(params: UpdateCommandInput): Promise<import("@aws-sdk/lib-dynamodb").UpdateCommandOutput>;
    /**
     * Delete an item by its primary key.
     */
    delete(params: DeleteCommandInput): Promise<import("@aws-sdk/lib-dynamodb").DeleteCommandOutput>;
    /**
     * Query items based on primary key and sort key conditions.
     */
    query(params: QueryCommandInput): Promise<import("@aws-sdk/lib-dynamodb").QueryCommandOutput>;
    /**
     * Scan the table or index for items.
     */
    scan(params: ScanCommandInput): Promise<import("@aws-sdk/lib-dynamodb").ScanCommandOutput>;
    /**
     * Get multiple items by their primary keys.
     */
    batchGet(params: BatchGetCommandInput): Promise<import("@aws-sdk/lib-dynamodb").BatchGetCommandOutput>;
    /**
     * Put or delete multiple items in one or more tables.
     */
    batchWrite(params: BatchWriteCommandInput): Promise<import("@aws-sdk/lib-dynamodb").BatchWriteCommandOutput>;
    getTableName(): string | undefined;
    getPkPrefix(): string;
}
export * from "./model";
export * from "./partition";
