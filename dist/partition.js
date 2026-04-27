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
exports.Partition = exports.Item = void 0;
class Item {
    constructor(partition, skValue, data) {
        this._indices = [];
        this._partition = partition;
        this._skValue = skValue;
        this._toBeDeleted = !!(data === null || data === void 0 ? void 0 : data._toBeDeleted);
        Object.assign(this, data);
        const self = this;
        return new Proxy(this, {
            get(target, prop, receiver) {
                if (prop === "save") {
                    return () => {
                        var _a, _b, _c;
                        const dataToSave = {};
                        for (const key in target) {
                            if (Object.prototype.hasOwnProperty.call(target, key) &&
                                !["_indices", "_partition", "_skValue", "_toBeDeleted"].includes(key) &&
                                typeof target[key] !== "function") {
                                dataToSave[key] = target[key];
                            }
                        }
                        return partition.update(skValue, dataToSave, self._indices, {
                            conditionBuilder: self._conditionBuilder,
                            ConditionExpression: (_a = self._rawCondition) === null || _a === void 0 ? void 0 : _a.expression,
                            ExpressionAttributeNames: (_b = self._rawCondition) === null || _b === void 0 ? void 0 : _b.names,
                            ExpressionAttributeValues: (_c = self._rawCondition) === null || _c === void 0 ? void 0 : _c.values,
                        });
                    };
                }
                if (prop === "create") {
                    return (data, indices) => {
                        var _a, _b, _c;
                        const dataToSave = data || {};
                        const finalIndices = indices || self._indices;
                        return partition.create(skValue, dataToSave, finalIndices, {
                            conditionBuilder: self._conditionBuilder,
                            ConditionExpression: (_a = self._rawCondition) === null || _a === void 0 ? void 0 : _a.expression,
                            ExpressionAttributeNames: (_b = self._rawCondition) === null || _b === void 0 ? void 0 : _b.names,
                            ExpressionAttributeValues: (_c = self._rawCondition) === null || _c === void 0 ? void 0 : _c.values,
                        });
                    };
                }
                if (prop === "update") {
                    return (data, indices) => {
                        var _a, _b, _c;
                        return partition.update(skValue, data, indices, {
                            conditionBuilder: self._conditionBuilder,
                            ConditionExpression: (_a = self._rawCondition) === null || _a === void 0 ? void 0 : _a.expression,
                            ExpressionAttributeNames: (_b = self._rawCondition) === null || _b === void 0 ? void 0 : _b.names,
                            ExpressionAttributeValues: (_c = self._rawCondition) === null || _c === void 0 ? void 0 : _c.values,
                        });
                    };
                }
                if (prop === "setFilter") {
                    return (builder) => {
                        self._filterBuilder = builder;
                        return receiver;
                    };
                }
                if (prop === "setCondition") {
                    return (builder) => {
                        self._conditionBuilder = builder;
                        self._rawCondition = undefined;
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
                    return (indexObj) => {
                        if (Array.isArray(indexObj)) {
                            self._indices.push(...indexObj);
                        }
                        else {
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
exports.Item = Item;
class Partition {
    constructor(db, config, id) {
        this.cache = {};
        this.isLoaded = false;
        this.lastEvaluatedKey = null;
        this.db = db;
        this.tableName = config.tableName || db.getTableName();
        this.pkName = db.getPkName();
        this.skName = db.getSkName();
        if (config.pk) {
            this.pkValue = config.pk;
        }
        else {
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
            }
            else {
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
    getAll(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let filterExpression = options === null || options === void 0 ? void 0 : options.FilterExpression;
            let expressionAttributeNames = Object.assign({ "#pk": this.pkName }, options === null || options === void 0 ? void 0 : options.ExpressionAttributeNames);
            let expressionAttributeValues = Object.assign({ ":pk": this.pkValue }, options === null || options === void 0 ? void 0 : options.ExpressionAttributeValues);
            if (options === null || options === void 0 ? void 0 : options.filterBuilder) {
                const { expression, attributeNames, attributeValues } = options.filterBuilder.build();
                filterExpression = expression;
                expressionAttributeNames = Object.assign(Object.assign({}, expressionAttributeNames), attributeNames);
                expressionAttributeValues = Object.assign(Object.assign({}, expressionAttributeValues), attributeValues);
            }
            const response = yield this.db.query({
                TableName: this.tableName,
                KeyConditionExpression: "#pk = :pk",
                FilterExpression: filterExpression,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                Limit: options === null || options === void 0 ? void 0 : options.limit,
                ExclusiveStartKey: options === null || options === void 0 ? void 0 : options.exclusiveStartKey,
            });
            const items = (response.Items || []);
            items.forEach((item) => {
                if (item[this.skName]) {
                    this.cache[item[this.skName]] = item;
                }
            });
            if (!(options === null || options === void 0 ? void 0 : options.exclusiveStartKey) && !response.LastEvaluatedKey) {
                this.isLoaded = true;
            }
            this.lastEvaluatedKey = response.LastEvaluatedKey || null;
            return items.map((item) => new Item(this, item[this.skName], item));
        });
    }
    /**
     * Create an item in this partition.
     */
    create(skValue, data, indices, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const item = Object.assign({ [this.pkName]: this.pkValue, [this.skName]: skValue }, data);
            if (indices) {
                indices.forEach((index) => {
                    item[index.getPkName()] = index.getPkValue();
                    if (index.getSkValue() !== undefined) {
                        item[index.getSkName()] = index.getSkValue();
                    }
                });
            }
            const createParams = {
                TableName: this.tableName,
                Item: item,
            };
            if (options === null || options === void 0 ? void 0 : options.conditionBuilder) {
                const { expression, attributeNames, attributeValues } = options.conditionBuilder.build();
                createParams.ConditionExpression = expression;
                createParams.ExpressionAttributeNames = Object.assign(Object.assign({}, createParams.ExpressionAttributeNames), attributeNames);
                createParams.ExpressionAttributeValues = Object.assign(Object.assign({}, createParams.ExpressionAttributeValues), attributeValues);
            }
            if (options === null || options === void 0 ? void 0 : options.ConditionExpression) {
                createParams.ConditionExpression = options.ConditionExpression;
                createParams.ExpressionAttributeNames = Object.assign(Object.assign({}, createParams.ExpressionAttributeNames), options.ExpressionAttributeNames);
                createParams.ExpressionAttributeValues = Object.assign(Object.assign({}, createParams.ExpressionAttributeValues), options.ExpressionAttributeValues);
            }
            yield this.db.create(createParams);
            this.cache[skValue] = item;
            return new Item(this, skValue, item);
        });
    }
    /**
     * Internal method to get raw data for a specific SK.
     */
    _getRaw(skValue) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cache[skValue] !== undefined) {
                return this.cache[skValue] || null;
            }
            if (this.isLoaded) {
                return null;
            }
            const response = yield this.db.get({
                TableName: this.tableName,
                Key: {
                    [this.pkName]: this.pkValue,
                    [this.skName]: skValue,
                },
            });
            const data = response.Item || null;
            if (data) {
                this.cache[skValue] = data;
            }
            return data;
        });
    }
    /**
     * Update an existing item in this partition.
     */
    update(skValue, data, indices, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const current = (yield this._getRaw(skValue)) || {};
            const updated = Object.assign(Object.assign({}, current), data);
            return yield this.create(skValue, updated, indices, options);
        });
    }
    /**
     * Delete an item by its SK within this partition.
     */
    delete(skValue, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const deleteParams = {
                TableName: this.tableName,
                Key: {
                    [this.pkName]: this.pkValue,
                    [this.skName]: skValue,
                },
            };
            if (options === null || options === void 0 ? void 0 : options.conditionBuilder) {
                const { expression, attributeNames, attributeValues } = options.conditionBuilder.build();
                deleteParams.ConditionExpression = expression;
                deleteParams.ExpressionAttributeNames = Object.assign(Object.assign({}, deleteParams.ExpressionAttributeNames), attributeNames);
                deleteParams.ExpressionAttributeValues = Object.assign(Object.assign({}, deleteParams.ExpressionAttributeValues), attributeValues);
            }
            if (options === null || options === void 0 ? void 0 : options.ConditionExpression) {
                deleteParams.ConditionExpression = options.ConditionExpression;
                deleteParams.ExpressionAttributeNames = Object.assign(Object.assign({}, deleteParams.ExpressionAttributeNames), options.ExpressionAttributeNames);
                deleteParams.ExpressionAttributeValues = Object.assign(Object.assign({}, deleteParams.ExpressionAttributeValues), options.ExpressionAttributeValues);
            }
            yield this.db.delete(deleteParams);
            delete this.cache[skValue];
        });
    }
    /**
     * Get data for a specific SK and return it wrapped in a Item object.
     */
    get(skValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield this._getRaw(skValue);
            return data ? new Item(this, skValue, data) : null;
        });
    }
    /**
     * Pre-draft an item for creation. Returns an Item object.
     * @param skValue The sort key value
     * @param data Initial data for the row
     */
    draft(skValue, data = {}) {
        return new Item(this, skValue, data);
    }
    /**
     * Pre-draft an item for deletion. Returns an Item object marked for deletion.
     * @param skValue The sort key value
     */
    draftDelete(skValue) {
        return new Item(this, skValue, { _toBeDeleted: true });
    }
    getTableName() {
        return this.tableName || "";
    }
    getPkValue() {
        return this.pkValue;
    }
    getLastEvaluatedKey() {
        return this.lastEvaluatedKey;
    }
    /**
     * Delete all data in this partition.
     */
    deleteAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.db.query({
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
                    yield this.db.delete({
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
        });
    }
}
exports.Partition = Partition;
