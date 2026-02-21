import { DynoQuery } from "./index";
import { Partition } from "./partition";

export interface IndexQueryConfig {
  tableName?: string;
  indexName: string;
  pkName?: string;
  skName?: string;
  pkPrefix?: string;
  pkValue: string;
}

export class IndexQuery {
  protected db: DynoQuery;
  protected tableName: string;
  protected indexName: string;
  protected pkName: string;
  protected skName: string;
  protected pkValue: string;

  constructor(db: DynoQuery, config: IndexQueryConfig) {
    this.db = db;
    this.tableName = config.tableName || db.getTableName() || "";
    this.indexName = config.indexName;
    this.pkName = config.pkName || (this.indexName + "PK");
    this.skName = config.skName || (this.indexName + "SK");

    const globalPrefix = db.getPkPrefix();
    const indexPrefix = config.pkPrefix || "";
    let finalPrefix = indexPrefix;

    if (globalPrefix && !indexPrefix.startsWith(globalPrefix)) {
      finalPrefix = globalPrefix + indexPrefix;
    }

    this.pkValue = `${finalPrefix}${config.pkValue}`;

    if (!this.tableName) {
      throw new Error("TableName must be provided in IndexQueryConfig or DynoQueryConfig");
    }
  }

  async get<T = any>(skValueOrOptions?: string | { skValue?: string, limit?: number, scanIndexForward?: boolean }): Promise<T[]> {
    let options: { skValue?: string, limit?: number, scanIndexForward?: boolean } = {};

    if (typeof skValueOrOptions === 'string') {
      options.skValue = skValueOrOptions;
    } else if (typeof skValueOrOptions === 'object') {
      options = skValueOrOptions;
    }

    let keyCondition = "#pk = :pk";
    const expressionAttributeNames: Record<string, string> = {
      "#pk": this.pkName,
    };
    const expressionAttributeValues: Record<string, any> = {
      ":pk": this.pkValue,
    };

    if (options.skValue) {
      keyCondition += " AND begins_with(#sk, :sk)";
      expressionAttributeNames["#sk"] = this.skName;
      expressionAttributeValues[":sk"] = options.skValue;
    }

    const response = await this.db.query({
      TableName: this.tableName,
      IndexName: this.indexName,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: options.limit,
      ScanIndexForward: options.scanIndexForward,
    });

    const items = (response.Items || []) as any[];
    return items.map(item => this.mapItemToModel(item));
  }

  async getAll<T = any>(): Promise<T[]> {
    return this.get<T>();
  }

  getPkValue(): string {
    return this.pkValue;
  }

  /**
   * Generates items for batch query.
   */
  batchGetInput(...sks: string[]): any[] {
    if (sks.length === 0) {
      return [{
        TableName: this.tableName,
        Key: { [this.pkName]: this.pkValue }
      }];
    }
    return sks.map(sk => ({
      TableName: this.tableName,
      Key: {
        [this.pkName]: this.pkValue,
        [this.skName]: sk
      }
    }));
  }

  /**
   * Generates items for batch write (put).
   */
  batchWriteInput(...items: any[]): any[] {
    return items.map(item => ({
      TableName: this.tableName,
      PutRequest: {
        Item: {
          [this.pkName]: this.pkValue,
          ...item
        }
      }
    }));
  }

  /**
   * Generates items for batch delete.
   */
  batchDeleteInput(...sks: string[]): any[] {
    return sks.map(sk => ({
      TableName: this.tableName,
      DeleteRequest: {
        Key: {
          [this.pkName]: this.pkValue,
          [this.skName]: sk
        }
      }
    }));
  }

  private mapItemToModel(item: any): any {
    const pkName = this.db.getPkName();
    const pkValue = item[pkName];

    if (!pkValue) return item;

    const registeredPartitions = this.db.getRegisteredPartitions();
    const globalPrefix = this.db.getPkPrefix();

    for (const [name, def] of Object.entries(registeredPartitions)) {
      const fullPrefix = globalPrefix + def.pkPrefix;
      if (pkValue.startsWith(fullPrefix)) {
        // Find the ID by removing the prefix
        const id = pkValue.substring(fullPrefix.length);

        // Return a Partition instance and attach the data to its cache.
        const partition = new Partition(this.db, { pkPrefix: fullPrefix }, id);

        // Pre-fill the cache if we have the SK
        const skName = this.db.getSkName();
        if (item[skName]) {
            partition["cache"][item[skName]] = item;
        }

        // Add a property __model to the item if it matches.
        item.__model = name;
        // Also provide a way to get the partition instance from the item
        item.getPartition = () => partition;

        return item;
      }
    }

    return item;
  }
}
