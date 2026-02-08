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
    const clientConfig: any = { ...config };
    // Remove properties that are not part of DynamoDBClientConfig
    delete clientConfig.tableName;
    delete clientConfig.pkPrefix;
    delete clientConfig.partitions;
    delete clientConfig.indexes;
    delete clientConfig.pkName;
    delete clientConfig.skName;

    this.client = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: {
        removeUndefinedValues: true,
      }
    });
    this.defaultTableName = config.tableName;
    this.globalPkPrefix = config.pkPrefix || "";
    this.pkName = config.pkName || "PK";
    this.skName = config.skName || "SK";

    if (config.partitions) {
      this.registeredPartitions = config.partitions;
      Object.entries(config.partitions).forEach(([name, def]) => {
        this[name] = (id: string) => {
          return new Partition(this, { pkPrefix: this.globalPkPrefix + def.pkPrefix }, id);
        };
      });
    }

    if (config.indexes) {
      const { IndexQuery } = require("./index-query");
      Object.entries(config.indexes).forEach(([name, def]) => {
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
  async batchGet(params: BatchGetCommandInput) {
    if (this.defaultTableName && params.RequestItems) {
      // Note: Batch operations are a bit trickier because TableName is a key in RequestItems
      // This wrapper doesn't automatically add it to RequestItems yet,
      // but let's see if we should handle it.
      // For now, let's keep it as is or add it if RequestItems is empty?
      // Usually BatchGetCommandInput is complex.
    }
    const command = new BatchGetCommand(params);
    return await this.docClient.send(command);
  }

  /**
   * Put or delete multiple items in one or more tables.
   */
  async batchWrite(params: BatchWriteCommandInput) {
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
