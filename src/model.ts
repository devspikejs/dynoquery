import { DynoQuery } from "./index";

export interface ModelConfig<T = any> {
  tableName?: string;
  pkPrefix: string;
  skValue: string;
  onUpdate?: (sk: any, data: any) => void;
}

export class Model<T = any> {
  protected db: DynoQuery;
  protected tableName?: string;
  protected pkPrefix: string;
  protected skValue: string;
  protected pkName: string;
  protected skName: string;
  protected onUpdate?: (sk: any, data: any) => void;

  constructor(db: DynoQuery, config: ModelConfig<T>) {
    this.db = db;
    this.tableName = config.tableName || db.getTableName();
    this.pkPrefix = config.pkPrefix;
    this.skValue = config.skValue;
    this.pkName = db.getPkName();
    this.skName = db.getSkName();
    this.onUpdate = config.onUpdate;

    if (!this.tableName) {
      throw new Error("TableName must be provided in ModelConfig or DynoQueryConfig");
    }
  }

  protected getTableName(): string {
    return this.tableName!;
  }

  getPK(id: string = ""): string {
    return `${this.pkPrefix}${id}`;
  }

  /**
   * Find an item by its identifier (part of the PK).
   * Assumes the SK is fixed as defined in ModelConfig.
   */
  async find(id: string = ""): Promise<T | null> {
    const response = await this.db.get({
      TableName: this.getTableName(),
      Key: {
        [this.pkName]: this.getPK(id),
        [this.skName]: this.skValue,
      },
    });
    return (response.Item as unknown as T) || null;
  }

  /**
   * Save an item.
   */
  async save(data: T, id: string = ""): Promise<void> {
    const item = {
      [this.pkName]: this.getPK(id),
      [this.skName]: this.skValue,
      ...data,
    };
    await this.db.create({
      TableName: this.getTableName(),
      Item: item,
    });
    if (this.onUpdate) {
      this.onUpdate(this.skValue, item as any);
    }
  }

  /**
   * Update an existing item.
   */
  async update(data: Partial<T>, id: string = ""): Promise<void> {
    // For simplicity in this wrapper, we use create (PutItem) to update the whole item
    // but the user might expect a partial update if we use UpdateCommand.
    // However, for single table and this kind of wrapper, often we just put the whole item.
    // If we want to support partial updates in the cache, we need the current item.

    const response = await this.db.get({
      TableName: this.getTableName(),
      Key: {
        [this.pkName]: this.getPK(id),
        [this.skName]: this.skValue,
      },
    });
    const current = (response.Item as unknown as T) || ({} as T);
    const updated = { ...current, ...data } as T;
    await this.save(updated, id);
  }

  /**
   * Delete an item by its identifier.
   */
  async remove(id: string = ""): Promise<void> {
    await this.db.delete({
      TableName: this.getTableName(),
      Key: {
        [this.pkName]: this.getPK(id),
        [this.skName]: this.skValue,
      },
    });
    if (this.onUpdate) {
      this.onUpdate(this.skValue, null);
    }
  }
}
