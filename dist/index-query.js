"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexQuery = void 0;
class IndexQuery {
    constructor(db, config) {
        this.lastEvaluatedKey = null;
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
    getAll(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const finalSkValue = (options === null || options === void 0 ? void 0 : options.skValue) || this.skValue;
            let keyCondition = "#pk = :pk";
            const expressionAttributeNames = Object.assign({ "#pk": this.pkName }, options === null || options === void 0 ? void 0 : options.expressionAttributeNames);
            const expressionAttributeValues = Object.assign({ ":pk": this.pkValue }, options === null || options === void 0 ? void 0 : options.expressionAttributeValues);
            if (finalSkValue) {
                keyCondition += " AND begins_with(#sk, :sk)";
                expressionAttributeNames["#sk"] = this.skName;
                expressionAttributeValues[":sk"] = finalSkValue;
            }
            const response = yield this.db.query({
                TableName: this.tableName,
                IndexName: this.indexName,
                KeyConditionExpression: keyCondition,
                FilterExpression: options === null || options === void 0 ? void 0 : options.filterExpression,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                Limit: options === null || options === void 0 ? void 0 : options.limit,
                ScanIndexForward: options === null || options === void 0 ? void 0 : options.scanIndexForward,
                ExclusiveStartKey: options === null || options === void 0 ? void 0 : options.exclusiveStartKey,
            });
            const items = (response.Items || []);
            const mappedItems = items.map(item => this.db.mapItemToModelItem(item));
            this.lastEvaluatedKey = response.LastEvaluatedKey || null;
            return mappedItems;
        });
    }
    get(skValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const items = yield this.getAll({ limit: 1, skValue });
            return items.length > 0 ? items[0] : null;
        });
    }
    getPkValue() {
        return this.pkValue;
    }
    getPkName() {
        return this.pkName;
    }
    getSkName() {
        return this.skName;
    }
    getSkValue() {
        return this.skValue;
    }
    getLastEvaluatedKey() {
        return this.lastEvaluatedKey;
    }
}
exports.IndexQuery = IndexQuery;
