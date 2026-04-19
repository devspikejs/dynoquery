import { DynoQuery } from "./index";
import { IndexQuery } from "./index-query";

export interface PartitionConfig {
  tableName?: string;
  pk?: string;
  pkPrefix?: string;
}

export class Partition {
  protected db: DynoQuery;
  protected tableName?: string;
  protected pkValue: string;
  protected pkName: string;
  protected skName: string;
  protected cache: Record<string, any> = {};
  protected isLoaded: boolean = false;
  protected lastEvaluatedKey: any = null;

  constructor(db: DynoQuery, config: PartitionConfig, id?: string) {
    this.db = db;
    this.tableName = config.tableName || db.getTableName();
    this.pkName = db.getPkName();
    this.skName = db.getSkName();

    if (config.pk) {
      this.pkValue = config.pk;
    } else {
      const globalPrefix = db.getPkPrefix();
      const partitionPrefix = config.pkPrefix || "";

      if (!config.pkPrefix && !id && !globalPrefix) {
        // This check might be too strict if we allow empty prefixes,
        // but Partition expects some way to form a PK.
        // If config.pkPrefix is missing, we use id.
      }

      if (config.pkPrefix || id || globalPrefix) {
        // If it's a Partition registered in DynoQuery, config.pkPrefix will already
        // include the global prefix because of how we register it.
        // But for manual instantiation (new Partition), we should probably add the global prefix too.

        let finalPrefix = partitionPrefix;

        // If it's NOT already starting with globalPrefix and globalPrefix exists, prepend it.
        // Actually, better to just trust the caller OR standardise.
        // Let's look at how we want to handle manual instantiation.

        if (globalPrefix && !partitionPrefix.startsWith(globalPrefix)) {
             finalPrefix = globalPrefix + partitionPrefix;
        }

        this.pkValue = `${finalPrefix}${id || ""}`;
      } else {
        throw new Error("Either pkValue or pkPrefix must be provided in PartitionConfig");
      }
    }

    if (!this.tableName) {
      throw new Error("TableName must be provided in PartitionConfig or DynoQueryConfig");
    }
  }

  /**
   * Fetches all items in the partition and caches them.
   * Returns the data and caches it.
   */
  async getAll<T = any>(options?: {
    limit?: number;
    exclusiveStartKey?: any;
    filterExpression?: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, any>;
  }): Promise<T[]> {
    const response = await this.db.query({
      TableName: this.tableName,
      KeyConditionExpression: "#pk = :pk",
      FilterExpression: options?.filterExpression,
      ExpressionAttributeNames: {
        "#pk": this.pkName,
        ...options?.expressionAttributeNames,
      },
      ExpressionAttributeValues: {
        ":pk": this.pkValue,
        ...options?.expressionAttributeValues,
      },
      Limit: options?.limit,
      ExclusiveStartKey: options?.exclusiveStartKey,
    });

    const items = (response.Items || []) as T[];
    items.forEach((item: any) => {
      if (item[this.skName]) {
        this.cache[item[this.skName]] = item;
      }
    });

    if (!options?.exclusiveStartKey && !response.LastEvaluatedKey) {
      this.isLoaded = true;
    }

    this.lastEvaluatedKey = response.LastEvaluatedKey || null;

    return items;
  }

  /**
   * Create an item in this partition.
   */
  async create<T = any>(sk: string, data: T, indices?: IndexQuery[]): Promise<void> {
    const item: any = {
      [this.pkName]: this.pkValue,
      [this.skName]: sk,
      ...data,
    };

    if (indices) {
      indices.forEach((index) => {
        item[index.getPkName()] = index.getPkValue();
        if (index.getSkValue() !== undefined) {
          item[index.getSkName()] = index.getSkValue();
        }
      });
    }

    await this.db.create({
      TableName: this.tableName,
      Item: item,
    });
    this.cache[sk] = item;
  }

  /**
   * Update an existing item in this partition.
   */
  async update<T = any>(sk: string, data: Partial<T>): Promise<void> {
    const current = await this.get<T>(sk) || ({} as T);
    const updated = { ...current, ...data } as T;
    await this.create(sk, updated);
  }

  /**
   * Delete an item by its SK within this partition.
   */
  async delete(sk: string): Promise<void> {
    await this.db.delete({
      TableName: this.tableName,
      Key: {
        [this.pkName]: this.pkValue,
        [this.skName]: sk,
      },
    });
    delete this.cache[sk];
  }

  /**
   * Get data for a specific SK within this partition.
   * If the partition is loaded, it returns from cache.
   * Otherwise, it fetches the data immediately.
   */
  async get<T = any>(sk: string): Promise<T | null> {
    if (this.cache[sk] !== undefined) {
      return (this.cache[sk] as T) || null;
    }

    if (this.isLoaded) {
      return null;
    }

    const response = await this.db.get({
      TableName: this.tableName,
      Key: {
        [this.pkName]: this.pkValue,
        [this.skName]: sk,
      },
    });

    const data = (response.Item as unknown as T) || null;
    if (data) {
      this.cache[sk] = data;
    }
    return data;
  }

  getPkValue(): string {
    return this.pkValue;
  }

  getLastEvaluatedKey(): any {
    return this.lastEvaluatedKey;
  }

  /**
   * Delete all data in this partition.
   */
  async deleteAll(): Promise<void> {
    const response = await this.db.query({
      TableName: this.tableName,
      KeyConditionExpression: "#pk = :pk",
      ExpressionAttributeNames: {
        "#pk": this.pkName,
      },
      ExpressionAttributeValues: {
        ":pk": this.pkValue,
      },
    });

    if (response.Items && response.Items.length > 0) {
      for (const item of response.Items) {
        await this.db.delete({
          TableName: this.tableName,
          Key: {
            [this.pkName]: item[this.pkName],
            [this.skName]: item[this.skName],
          },
        });
      }
    }

    this.cache = {};
    this.isLoaded = false;
  }
}
