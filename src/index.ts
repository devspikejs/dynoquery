import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
  PutCommandInput,
  GetCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  ScanCommandInput,
  BatchGetCommandInput,
  BatchWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { Partition } from "./partition";

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
  partitions?: Record<string, { pkPrefix: string }>;
  indexes?: Record<string, { indexName: string, pkName?: string, skName?: string, pkPrefix?: string }>;
}

export type BatchGetInput = BatchGetCommandInput & {
  Items?: any[];
};

export type BatchWriteInput = BatchWriteCommandInput & {
  Items?: any[];
};

export class DynoQuery {
  private client: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private defaultTableName?: string;
  private globalPkPrefix: string;
  private pkName: string;
  private skName: string;
  private registeredPartitions: Record<string, { pkPrefix: string }> = {};
  [key: string]: any;

  constructor(config: DynoQueryConfig = {}) {
    const {
      tableName,
      pkName,
      skName,
      pkPrefix,
      partitions,
      indexes,
      ...clientConfig
    } = config;

    this.client = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: {
        removeUndefinedValues: true,
      }
    });
    this.defaultTableName = tableName;
    this.globalPkPrefix = pkPrefix || "";
    this.pkName = pkName || "PK";
    this.skName = skName || "SK";

    if (partitions) {
      this.registeredPartitions = partitions;
      Object.entries(partitions).forEach(([name, def]) => {
        this[name] = (id: string) => {
          return new Partition(this, { pkPrefix: this.globalPkPrefix + def.pkPrefix }, id);
        };
      });
    }

    if (indexes) {
      const { IndexQuery } = require("./index-query");
      Object.entries(indexes).forEach(([name, def]) => {
        this[name] = (id: string) => {
          return new IndexQuery(this, {
            indexName: def.indexName,
            pkName: def.pkName,
            skName: def.skName,
            pkPrefix: def.pkPrefix,
            pkValue: id
          });
        };
      });
    }
  }

  /**
   * Create or replace an item in the table.
   */
  async create(params: PutCommandInput) {
    if (!params.TableName && this.defaultTableName) {
      params.TableName = this.defaultTableName;
    }
    const command = new PutCommand(params);
    return await this.docClient.send(command);
  }

  /**
   * Get an item by its primary key.
   */
  async get(params: GetCommandInput) {
    if (!params.TableName && this.defaultTableName) {
      params.TableName = this.defaultTableName;
    }
    const command = new GetCommand(params);
    return await this.docClient.send(command);
  }

  /**
   * Update an existing item.
   */
  async update(params: UpdateCommandInput) {
    if (!params.TableName && this.defaultTableName) {
      params.TableName = this.defaultTableName;
    }
    const command = new UpdateCommand(params);
    return await this.docClient.send(command);
  }

  /**
   * Delete an item by its primary key.
   */
  async delete(params: DeleteCommandInput) {
    if (!params.TableName && this.defaultTableName) {
      params.TableName = this.defaultTableName;
    }
    const command = new DeleteCommand(params);
    return await this.docClient.send(command);
  }

  /**
   * Query items based on primary key and sort key conditions.
   */
  async query(params: QueryCommandInput) {
    if (!params.TableName && this.defaultTableName) {
      params.TableName = this.defaultTableName;
    }
    const command = new QueryCommand(params);
    return await this.docClient.send(command);
  }

  /**
   * Scan the table or index for items.
   */
  async scan(params: ScanCommandInput) {
    if (!params.TableName && this.defaultTableName) {
      params.TableName = this.defaultTableName;
    }
    const command = new ScanCommand(params);
    return await this.docClient.send(command);
  }

  /**
   * Get multiple items by their primary keys.
   */
  async batchGet(params: BatchGetInput | any, ...additionalItems: any[][]) {
    let finalParams: BatchGetInput;

    if (params && !params.RequestItems && !params.Items && (Array.isArray(params) || additionalItems.length > 0)) {
      // Handle the case where arguments are multiple arrays of items
      const allItems = Array.isArray(params) ? [...params] : [];
      additionalItems.forEach(chunk => {
        if (Array.isArray(chunk)) {
          allItems.push(...chunk);
        } else {
          allItems.push(chunk);
        }
      });

      finalParams = {
        Items: allItems
      } as any;
    } else {
      finalParams = params;
    }

    if (!finalParams.RequestItems && finalParams.Items) {
      finalParams.RequestItems = {};
      
      finalParams.Items.forEach((item: any) => {
        const tableName = item.TableName || this.defaultTableName;
        if (!tableName) {
          throw new Error("TableName must be provided for batch operations if no default tableName is set");
        }

        if (!finalParams.RequestItems![tableName]) {
          finalParams.RequestItems![tableName] = { Keys: [] };
        }

        const key = item.Key || item;
        finalParams.RequestItems![tableName].Keys!.push(key);
      });

      delete finalParams.Items;
    } else if (!finalParams.RequestItems && this.defaultTableName) {
      finalParams.RequestItems = {};
    }
    const command = new BatchGetCommand(finalParams);
    return await this.docClient.send(command);
  }

  /**
   * Put or delete multiple items in one or more tables.
   */
  async batchWrite(params: BatchWriteInput) {
    if (!params.RequestItems && params.Items) {
      params.RequestItems = {};
      
      params.Items.forEach((item: any) => {
        const tableName = item.TableName || this.defaultTableName;
        if (!tableName) {
          throw new Error("TableName must be provided for batch operations if no default tableName is set");
        }

        if (!params.RequestItems![tableName]) {
          params.RequestItems![tableName] = [];
        }

        const request = item.PutRequest || item.DeleteRequest ? item : { PutRequest: { Item: item } };
        params.RequestItems![tableName].push(request);
      });

      delete params.Items;
    } else if (!params.RequestItems && this.defaultTableName) {
      params.RequestItems = {};
    }
    const command = new BatchWriteCommand(params);
    return await this.docClient.send(command);
  }

  getTableName(): string | undefined {
    return this.defaultTableName;
  }

  getPkPrefix(): string {
    return this.globalPkPrefix;
  }

  getPkName(): string {
    return this.pkName;
  }

  getSkName(): string {
    return this.skName;
  }

  getRegisteredPartitions(): Record<string, { pkPrefix: string }> {
    return this.registeredPartitions;
  }
}

export * from "./model";
export * from "./partition";
export * from "./index-query";
