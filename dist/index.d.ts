import { PutCommandInput, GetCommandInput, UpdateCommandInput, DeleteCommandInput, QueryCommandInput, ScanCommandInput } from "@aws-sdk/lib-dynamodb";
export interface DynoQueryConfig {
    tableName?: string;
    pkName?: string;
    skName?: string;
    region?: string;
    endpoint?: string;
    pkPrefix?: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    };
    models?: Record<string, {
        pkPrefix: string;
    }>;
    findBy?: Record<string, {
        indexName: string;
        pkName?: string;
        skName?: string;
        pkPrefix?: string;
    }>;
}
export declare class DynoQuery {
    private client;
    private docClient;
    private defaultTableName?;
    private globalPkPrefix;
    private pkName;
    private skName;
    private registeredModels;
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
    getTableName(): string | undefined;
    getPkPrefix(): string;
    getPkName(): string;
    getSkName(): string;
    getRegisteredModels(): Record<string, {
        pkPrefix: string;
    }>;
}
export * from "./partition";
export * from "./index-query";
