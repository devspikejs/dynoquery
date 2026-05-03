import { DynoQuery } from "./index";
import { Item, Partition } from "./partition";
import { ExpressionBuilder } from "./expression-builder";

export interface IndexQueryConfig {
  tableName?: string;
  indexName: string;
  pkName?: string;
  skName?: string;
  pkPrefix?: string;
  pkValue: string;
  skValue?: string;
}

export class IndexQuery {
  protected db: DynoQuery;
  protected tableName: string;
  protected indexName: string;
  protected pkName: string;
  protected skName: string;
  protected pkValue: string;
  protected skValue?: string;
  protected LastEvaluatedKey: any = null;

  constructor(db: DynoQuery, config: IndexQueryConfig) {
    this.db = db;
    this.tableName = config.tableName || db.getTableName() || "";
    this.indexName = config.indexName;
    this.pkName = config.pkName || (this.indexName + "PK");
    this.skName = config.skName || (this.indexName + "SK");
    this.skValue = config.skValue;

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

  async getAll<T = any>(options?: {
    Limit?: number;
    ScanIndexForward?: boolean;
    ExclusiveStartKey?: any;
    skValue?: string;
    filterBuilder?: ExpressionBuilder;
    FilterExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, any>;
  }): Promise<T[]> {
    const finalSkValue = options?.skValue || this.skValue;

    let keyCondition = "#pk = :pk";
    let expressionAttributeNames: Record<string, string> = {
      "#pk": this.pkName,
      ...options?.ExpressionAttributeNames,
    };
    let expressionAttributeValues: Record<string, any> = {
      ":pk": this.pkValue,
      ...options?.ExpressionAttributeValues,
    };

    if (finalSkValue) {
      keyCondition += " AND begins_with(#sk, :sk)";
      expressionAttributeNames["#sk"] = this.skName;
      expressionAttributeValues[":sk"] = finalSkValue;
    }

    let filterExpression = options?.FilterExpression;

    if (options?.filterBuilder) {
        const { expression, attributeNames, attributeValues } = options.filterBuilder.build();
        filterExpression = expression;
        expressionAttributeNames = { ...expressionAttributeNames, ...attributeNames };
        expressionAttributeValues = { ...expressionAttributeValues, ...attributeValues };
    }

    const response = await this.db.query({
      TableName: this.tableName,
      IndexName: this.indexName,
      KeyConditionExpression: keyCondition,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: options?.Limit,
      ScanIndexForward: options?.ScanIndexForward,
      ExclusiveStartKey: options?.ExclusiveStartKey,
    });

    const items = (response.Items || []) as any[];
    const mappedItems = items.map(item => this.db.mapItemToModelItem(item));

    this.LastEvaluatedKey = response.LastEvaluatedKey || null;

    return mappedItems as T[];
  }

  async get<T = any>(skValue?: string): Promise<T | null> {
    const items = await this.getAll<T>({ Limit: 1, skValue });
    return items.length > 0 ? items[0] : null;
  }

  getPkValue(): string {
    return this.pkValue;
  }

  getPkName(): string {
    return this.pkName;
  }

  getSkName(): string {
    return this.skName;
  }

  getSkValue(): string | undefined {
    return this.skValue;
  }

  getLastEvaluatedKey(): any {
    return this.LastEvaluatedKey;
  }

}
