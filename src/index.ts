import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  PutCommandInput,
  GetCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  ScanCommandInput,
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
  models?: Record<string, { pkPrefix: string }>;
  indexes?: Record<string, { indexName: string, pkName?: string, skName?: string, pkPrefix?: string }>;
}

export class DynoQuery {
  private client: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private defaultTableName?: string;
  private globalPkPrefix: string;
  private pkName: string;
  private skName: string;
  private registeredModels: Record<string, { pkPrefix: string }> = {};
  [key: string]: any;

  constructor(config: DynoQueryConfig = {}) {
    const {
      tableName,
      pkName,
      skName,
      pkPrefix,
      models,
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

    if (models) {
      this.registeredModels = models;
      Object.entries(models).forEach(([name, def]) => {
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

  getRegisteredModels(): Record<string, { pkPrefix: string }> {
    return this.registeredModels;
  }
}

export * from "./partition";
export * from "./index-query";
