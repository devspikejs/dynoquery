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
        this.pkName = config.pkName || "GSI1PK";
        this.skName = config.skName || "GSI1SK";
        this.pkValue = config.pkValue;
        if (!this.tableName) {
            throw new Error("TableName must be provided in IndexQueryConfig or DynoQueryConfig");
        }
    }
    query() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
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
                // We can't easily return a "Model" or "Partition" instance here that is fully typed
                // But the user asked: "identify the model and set the value as that model"
                // In JS, we can't easily change the class of an object after the fact without some effort
                // but we can return an instance of Partition if we want, or just the data.
                // The requirement says: "if the pk value starts with the pkPrefix, we can identify the model and set the value as that model"
                // Maybe it means returning a Partition instance? 
                // Or maybe just adding a property to indicate the model type?
                // Let's return a Partition instance and attach the data to its cache.
                const partition = new partition_1.Partition(this.db, { pkPrefix: fullPrefix }, id);
                // We can pre-fill the cache if we have the SK
                const skName = this.db.getSkName();
                if (item[skName]) {
                    partition["cache"][item[skName]] = item;
                }
                // However, the user might just want the data.
                // If we return a Partition, it's not the "data" itself.
                // Let's check the requirement again.
                // "identify the model and set the value as that model"
                // If they want to use it like: results.forEach(user => user.get('METADATA'))
                // Then returning Partition makes sense.
                // But usually query returns data.
                // Let's add a property __model to the item if it matches.
                item.__model = name;
                // Also provide a way to get the partition instance from the item?
                item.getPartition = () => new partition_1.Partition(this.db, { pkPrefix: fullPrefix }, id);
                return item;
            }
        }
        return item;
    }
}
exports.IndexQuery = IndexQuery;
