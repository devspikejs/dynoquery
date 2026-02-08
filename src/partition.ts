import { DynoQuery } from "./index";
import { Model, ModelConfig } from "./model";

export interface PartitionConfig {
  tableName?: string;
  pk?: string;
  pkPrefix?: string;
}

export class Partition {
  protected db: DynoQuery;
  protected tableName?: string;
  protected pk: string;
  protected pkName: string;
  protected skName: string;
  protected cache: Record<string, any> = {};
  protected isLoaded: boolean = false;

  constructor(db: DynoQuery, config: PartitionConfig, id?: string) {
    this.db = db;
    this.tableName = config.tableName || db.getTableName();
    this.pkName = db.getPkName();
    this.skName = db.getSkName();

    if (config.pk) {
      this.pk = config.pk;
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

        this.pk = `${finalPrefix}${id || ""}`;
      } else {
        throw new Error("Either pk or pkPrefix must be provided in PartitionConfig");
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
  async getAll<T = any>(): Promise<T[]> {
    const response = await this.db.query({
      TableName: this.tableName,
      KeyConditionExpression: "#pk = :pk",
      ExpressionAttributeNames: {
        "#pk": this.pkName,
      },
      ExpressionAttributeValues: {
        ":pk": this.pk,
      },
    });

    const items = (response.Items || []) as T[];
    items.forEach((item: any) => {
      if (item[this.skName]) {
        this.cache[item[this.skName]] = item;
      }
    });
    this.isLoaded = true;
    return items;
  }

  /**
   * Get a model instance for a specific SK within this partition.
   */
  model<T = any>(sk: string): Model<T> {
    const config: ModelConfig<T> = {
      tableName: this.tableName,
      pkPrefix: this.pk, // In this context, pk is fixed, so prefix is the full PK
      skValue: sk,
      onUpdate: (updatedSk: any, data: any) => {
        if (data === null) {
          delete this.cache[updatedSk];
        } else {
          this.cache[updatedSk] = data;
        }
      }
    };
    return new Model<T>(this.db, config);
  }

  getPK(): string {
    return this.pk;
  }

  /**
   * Create an item in this partition and return the model.
   */
  async create<T = any>(sk: string, data: T): Promise<Model<T>> {
    const m = this.model<T>(sk);
    await m.save(data);
    return m;
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

    const model = this.model<T>(sk);
    const data = await model.find();
    if (data) {
      this.cache[sk] = data;
    }
    return data;
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
        ":pk": this.pk,
      },
    });

    if (response.Items && response.Items.length > 0) {
      // DynamoDB BatchWriteItem supports up to 25 requests at once
      const items = response.Items;
      const chunks: any[][] = [];
      for (let i = 0; i < items.length; i += 25) {
        chunks.push(items.slice(i, i + 25));
      }

      for (const chunk of chunks) {
        const deleteRequests = chunk.map((item) => ({
          DeleteRequest: {
            Key: {
              [this.pkName]: item[this.pkName],
              [this.skName]: item[this.skName],
            },
          },
        }));

        await this.db.batchWrite({
          RequestItems: {
            [this.tableName!]: deleteRequests,
          },
        });
      }
    }

    this.cache = {};
    this.isLoaded = false;
  }
}
