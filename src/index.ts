import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
  BatchGetCommand,
  PutCommandInput,
  GetCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { Partition, Item } from "./partition";
import { IndexQuery } from "./index-query";
import { ExpressionBuilder, attr } from "./expression-builder";

export { ExpressionBuilder, attr };

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
  findBy?: Record<string, { indexName: string, pkName?: string, skName?: string, pkPrefix?: string }>;
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
      findBy,
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
        this[name] = (id: string, skValue?: string) => {
          const partition = new Partition(this, { pkPrefix: this.globalPkPrefix + def.pkPrefix }, id);
          if (skValue) {
            return partition.draft(skValue);
          }
          return partition;
        };
      });
    }

    if (findBy) {
      const { IndexQuery } = require("./index-query");
      Object.entries(findBy).forEach(([name, def]) => {
        const methodName = `findBy${name}`;
        this[methodName] = (id: string, skValue?: string) => {
          return new IndexQuery(this, {
            indexName: def.indexName,
            pkName: def.pkName,
            skName: def.skName,
            pkPrefix: def.pkPrefix,
            pkValue: id,
            skValue: skValue
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
   * Batch write items to the table.
   */
  async batchWrite(items: Item[]) {
    const tableGroups: Record<string, any[]> = {};

    items.forEach((item: any) => {
      const partition = item.getPartition();
      const tableName = partition.getTableName();
      const skValue = item.getSkValue();

      if (!tableGroups[tableName]) {
        tableGroups[tableName] = [];
      }

      if (item.toBeDeleted()) {
        tableGroups[tableName].push({
          DeleteRequest: {
            Key: {
              [this.pkName]: partition.getPkValue(),
              [this.skName]: skValue,
            },
          },
        });
      } else {
        const dataToSave: any = {};
        for (const key in item) {
          if (
            Object.prototype.hasOwnProperty.call(item, key) &&
            !["_indices", "_partition", "_skValue", "_toBeDeleted"].includes(key) &&
            typeof item[key] !== "function"
          ) {
            dataToSave[key] = item[key];
          }
        }

        // Ensure PK and SK are in the data
        dataToSave[this.pkName] = partition.getPkValue();
        dataToSave[this.skName] = skValue;

        tableGroups[tableName].push({
          PutRequest: {
            Item: dataToSave,
          },
        });
      }
    });

    const results: any[] = [];
    const tableNames = Object.keys(tableGroups);

    for (const tableName of tableNames) {
      const requests = tableGroups[tableName];
      // Chunk requests into 25
      for (let i = 0; i < requests.length; i += 25) {
        const chunk = requests.slice(i, i + 25);
        await this.docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [tableName]: chunk,
            },
          })
        );
      }
    }

    return items;
  }

  /**
   * Batch get items from the table.
   */
  async batchRead(items: (Item | IndexQuery)[]) {
    const tableGroups: Record<string, any[]> = {};
    const requestMap: Record<string, Item | IndexQuery> = {};

    items.forEach((item: any) => {
      let tableName: string;
      let pkValue: string;
      let skValue: string;

      if (item instanceof IndexQuery) {
        tableName = (item as any).tableName;
        pkValue = item.getPkValue();
        skValue = item.getSkValue() || "";
      } else {
        const partition = item.getPartition();
        tableName = partition.getTableName();
        pkValue = partition.getPkValue();
        skValue = item.getSkValue();
      }

      if (!tableGroups[tableName]) {
        tableGroups[tableName] = [];
      }

      const key = {
        [this.pkName]: pkValue,
        [this.skName]: skValue,
      };

      tableGroups[tableName].push(key);
      const requestKey = `${tableName}|${pkValue}|${skValue}`;
      requestMap[requestKey] = item;
    });

    const allItems: any[] = [];
    const tableNames = Object.keys(tableGroups);

    for (const tableName of tableNames) {
      const keys = tableGroups[tableName];
      for (let i = 0; i < keys.length; i += 100) {
        const chunk = keys.slice(i, i + 100);
        const response = await this.docClient.send(
          new BatchGetCommand({
            RequestItems: {
              [tableName]: {
                Keys: chunk,
              },
            },
          })
        );

        if (response.Responses && response.Responses[tableName]) {
          const items = response.Responses[tableName];
          items.forEach((item: any) => {
            const mappedItem = this.mapItemToModelItem(item);
            allItems.push(mappedItem);
          });
        }
      }
    }

    return allItems;
  }

  /**
   * Maps a raw DynamoDB item to a Model Item if it matches a registered model.
   */
  public mapItemToModelItem(item: any): any {
    const pkValue = item[this.pkName];
    if (!pkValue) return item;

    for (const [name, def] of Object.entries(this.registeredModels)) {
      const fullPrefix = this.globalPkPrefix + def.pkPrefix;
      if (pkValue.startsWith(fullPrefix)) {
        const id = pkValue.substring(fullPrefix.length);
        const partition = new Partition(this, { pkPrefix: fullPrefix }, id);
        const skValue = item[this.skName];

        if (skValue) {
          partition["cache"][skValue] = item;
        }

        // Add metadata to the item
        item.__model = name;
        item.getPartition = () => partition;

        if (skValue) {
          return new Item(partition, skValue, item);
        }
      }
    }
    return item;
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
export { Item } from "./partition";
export * from "./index-query";
