import { DynoQuery } from "./index";
import { IndexQuery } from "./index-query";
import { ExpressionBuilder } from "./expression-builder";

export interface PartitionConfig {
  tableName?: string;
  pk?: string;
  pkPrefix?: string;
}

export class Item {
  [key: string]: any;
  private _indices: IndexQuery[] = [];
  private _partition: Partition;
  private _skValue: string;
  private _toBeDeleted: boolean;
  private _filterBuilder?: ExpressionBuilder;
  private _conditionBuilder?: ExpressionBuilder;

  constructor(partition: Partition, skValue: string, data: any) {
    this._partition = partition;
    this._skValue = skValue;
    this._toBeDeleted = !!data?._toBeDeleted;
    Object.assign(this, data);

    const self = this;
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop === "getData") {
          return () => {
            const data: any = {};
            for (const key in target) {
              if (
                Object.prototype.hasOwnProperty.call(target, key) &&
                ![
                  "_indices",
                  "_partition",
                  "_skValue",
                  "_toBeDeleted",
                  "_filterBuilder",
                  "_conditionBuilder",
                ].includes(key) &&
                typeof target[key] !== "function"
              ) {
                data[key] = target[key];
              }
            }
            return data;
          };
        }
        if (prop === "save") {
          return () => {
            return partition.update(skValue, receiver.getData(), self._indices, {
              conditionBuilder: self._conditionBuilder,
            });
          };
        }
        if (prop === "create") {
          return (data?: any, indices?: IndexQuery[]) => {
            const dataToSave = data || {};
            const finalIndices = indices || self._indices;
            return partition.create(skValue, dataToSave, finalIndices, {
              conditionBuilder: self._conditionBuilder,
            });
          };
        }
        if (prop === "update") {
          return (data: any, indices?: IndexQuery[]) => {
            return partition.update(skValue, data, indices, {
              conditionBuilder: self._conditionBuilder,
            });
          };
        }
        if (prop === "setFilter") {
          return (builder: ExpressionBuilder) => {
            self._filterBuilder = builder;
            return receiver;
          };
        }
        if (prop === "setCondition") {
          return (builder: ExpressionBuilder) => {
            self._conditionBuilder = builder;
            return receiver;
          };
        }
        if (prop === "getFilterBuilder") {
          return () => self._filterBuilder;
        }
        if (prop === "getConditionBuilder") {
          return () => self._conditionBuilder;
        }
        if (prop === "setIndex") {
          return (indexObj: IndexQuery | IndexQuery[]) => {
            if (Array.isArray(indexObj)) {
              self._indices.push(...indexObj);
            } else {
              self._indices.push(indexObj);
            }
            return receiver;
          };
        }
        if (prop === "getPartition") {
          return () => partition;
        }
        if (prop === "getSkValue") {
          return () => skValue;
        }
        if (prop === "toBeDeleted") {
          return () => self._toBeDeleted;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
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
    filterBuilder?: ExpressionBuilder;
    FilterExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, any>;
  }): Promise<T[]> {
    let filterExpression = options?.FilterExpression;
    let expressionAttributeNames: Record<string, string> = {
      "#pk": this.pkName,
      ...options?.ExpressionAttributeNames,
    };
    let expressionAttributeValues: Record<string, any> = {
      ":pk": this.pkValue,
      ...options?.ExpressionAttributeValues,
    };

    if (options?.filterBuilder) {
      const { expression, attributeNames, attributeValues } = options.filterBuilder.build();
      filterExpression = expression;
      expressionAttributeNames = { ...expressionAttributeNames, ...attributeNames };
      expressionAttributeValues = { ...expressionAttributeValues, ...attributeValues };
    }

    const response = await this.db.query({
      TableName: this.tableName,
      KeyConditionExpression: "#pk = :pk",
      FilterExpression: filterExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
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

    return items.map((item: any) => new Item(this, item[this.skName], item) as any);
  }

  /**
   * Create an item in this partition.
   */
  async create<T = any>(
    skValue: string,
    data: T,
    indices?: IndexQuery[],
    options?: {
      conditionBuilder?: ExpressionBuilder;
      ConditionExpression?: string;
      ExpressionAttributeNames?: Record<string, string>;
      ExpressionAttributeValues?: Record<string, any>;
    }
  ): Promise<T> {
    const item: any = {
      [this.pkName]: this.pkValue,
      [this.skName]: skValue,
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

    const createParams: any = {
      TableName: this.tableName,
      Item: item,
    };

    if (options?.conditionBuilder) {
      const { expression, attributeNames, attributeValues } = options.conditionBuilder.build();
      createParams.ConditionExpression = expression;
      if (Object.keys(attributeNames).length > 0) {
        createParams.ExpressionAttributeNames = {
          ...createParams.ExpressionAttributeNames,
          ...attributeNames,
        };
      }
      if (Object.keys(attributeValues).length > 0) {
        createParams.ExpressionAttributeValues = {
          ...createParams.ExpressionAttributeValues,
          ...attributeValues,
        };
      }
    }

    if (options?.ConditionExpression) {
      createParams.ConditionExpression = options.ConditionExpression;
      if (options.ExpressionAttributeNames && Object.keys(options.ExpressionAttributeNames).length > 0) {
        createParams.ExpressionAttributeNames = {
          ...createParams.ExpressionAttributeNames,
          ...options.ExpressionAttributeNames,
        };
      }
      if (options.ExpressionAttributeValues && Object.keys(options.ExpressionAttributeValues).length > 0) {
        createParams.ExpressionAttributeValues = {
          ...createParams.ExpressionAttributeValues,
          ...options.ExpressionAttributeValues,
        };
      }
    }

    await this.db.create(createParams);
    this.cache[skValue] = item;
    return new Item(this, skValue, item) as any;
  }

  /**
   * Internal method to get raw data for a specific SK.
   */
  private async _getRaw<T = any>(skValue: string): Promise<T | null> {
    if (this.cache[skValue] !== undefined) {
      return (this.cache[skValue] as T) || null;
    }

    if (this.isLoaded) {
      return null;
    }

    const response = await this.db.get({
      TableName: this.tableName,
      Key: {
        [this.pkName]: this.pkValue,
        [this.skName]: skValue,
      },
    });

    const data = (response.Item as unknown as T) || null;
    if (data) {
      this.cache[skValue] = data;
    }
    return data;
  }

  /**
   * Update an existing item in this partition.
   */
  async update<T = any>(
    skValue: string,
    data: Partial<T>,
    indices?: IndexQuery[],
    options?: {
      conditionBuilder?: ExpressionBuilder;
      ConditionExpression?: string;
      ExpressionAttributeNames?: Record<string, string>;
      ExpressionAttributeValues?: Record<string, any>;
    }
  ): Promise<T> {
    const current = await this._getRaw(skValue);
    const updated = { ...(current || {}), ...data } as T;
    return await this.create(skValue, updated, indices, options);
  }

  /**
   * Delete an item by its SK within this partition.
   */
  async delete(
    skValue: string,
    options?: {
      conditionBuilder?: ExpressionBuilder;
      ConditionExpression?: string;
      ExpressionAttributeNames?: Record<string, string>;
      ExpressionAttributeValues?: Record<string, any>;
    }
  ): Promise<void> {
    const deleteParams: any = {
      TableName: this.tableName,
      Key: {
        [this.pkName]: this.pkValue,
        [this.skName]: skValue,
      },
    };

    if (options?.conditionBuilder) {
      const { expression, attributeNames, attributeValues } = options.conditionBuilder.build();
      deleteParams.ConditionExpression = expression;
      if (Object.keys(attributeNames).length > 0) {
        deleteParams.ExpressionAttributeNames = {
          ...deleteParams.ExpressionAttributeNames,
          ...attributeNames,
        };
      }
      if (Object.keys(attributeValues).length > 0) {
        deleteParams.ExpressionAttributeValues = {
          ...deleteParams.ExpressionAttributeValues,
          ...attributeValues,
        };
      }
    }

    if (options?.ConditionExpression) {
      deleteParams.ConditionExpression = options.ConditionExpression;
      if (options.ExpressionAttributeNames && Object.keys(options.ExpressionAttributeNames).length > 0) {
        deleteParams.ExpressionAttributeNames = {
          ...deleteParams.ExpressionAttributeNames,
          ...options.ExpressionAttributeNames,
        };
      }
      if (options.ExpressionAttributeValues && Object.keys(options.ExpressionAttributeValues).length > 0) {
        deleteParams.ExpressionAttributeValues = {
          ...deleteParams.ExpressionAttributeValues,
          ...options.ExpressionAttributeValues,
        };
      }
    }

    await this.db.delete(deleteParams);
    delete this.cache[skValue];
  }

  /**
   * Get data for a specific SK and return it wrapped in a Item object.
   */
  async get<T = any>(skValue: string): Promise<T | null> {
    const data = await this._getRaw<T>(skValue);
    return data ? (new Item(this, skValue, data) as any) : null;
  }

  /**
   * Pre-draft an item for creation. Returns an Item object.
   * @param skValue The sort key value
   * @param data Initial data for the row
   */
  draft<T = any>(skValue: string, data: any = {}): T {
    return new Item(this, skValue, data) as any;
  }

  /**
   * Pre-draft an item for deletion. Returns an Item object marked for deletion.
   * @param skValue The sort key value
   */
  draftDelete<T = any>(skValue: string): T {
    return new Item(this, skValue, { _toBeDeleted: true }) as any;
  }


  getTableName(): string {
    return this.tableName || "";
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
