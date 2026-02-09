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
const partition_1 = require("./partition");
class IndexQuery {
    constructor(db, config) {
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
    get(skValueOrOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            let options = {};
            if (typeof skValueOrOptions === 'string') {
                options.skValue = skValueOrOptions;
            }
            else if (typeof skValueOrOptions === 'object') {
                options = skValueOrOptions;
            }
            let keyCondition = "#pk = :pk";
            const expressionAttributeNames = {
                "#pk": this.pkName,
            };
            const expressionAttributeValues = {
                ":pk": this.pkValue,
            };
            if (options.skValue) {
                keyCondition += " AND begins_with(#sk, :sk)";
                expressionAttributeNames["#sk"] = this.skName;
                expressionAttributeValues[":sk"] = options.skValue;
            }
            const response = yield this.db.query({
                TableName: this.tableName,
                IndexName: this.indexName,
                KeyConditionExpression: keyCondition,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                Limit: options.limit,
                ScanIndexForward: options.scanIndexForward,
            });
            const items = (response.Items || []);
            return items.map(item => this.mapItemToModel(item));
        });
    }
    getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get();
        });
    }
    mapItemToModel(item) {
        const pkName = this.db.getPkName();
        const pkValue = item[pkName];
        if (!pkValue)
            return item;
        const registeredPartitions = this.db.getRegisteredPartitions();
        const globalPrefix = this.db.getPkPrefix();
        for (const [name, def] of Object.entries(registeredPartitions)) {
            const fullPrefix = globalPrefix + def.pkPrefix;
            if (pkValue.startsWith(fullPrefix)) {
                // Find the ID by removing the prefix
                const id = pkValue.substring(fullPrefix.length);
                // Return a Partition instance and attach the data to its cache.
                const partition = new partition_1.Partition(this.db, { pkPrefix: fullPrefix }, id);
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
exports.IndexQuery = IndexQuery;
