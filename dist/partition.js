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
exports.Partition = void 0;
class Partition {
    constructor(db, config, id) {
        this.cache = {};
        this.isLoaded = false;
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
    getAll() {
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
            const items = (response.Items || []);
            items.forEach((item) => {
                if (item[this.skName]) {
                    this.cache[item[this.skName]] = item;
                }
            });
            this.isLoaded = true;
            return items;
        });
    }
    /**
     * Create an item in this partition.
     */
    create(sk, data, indices) {
        return __awaiter(this, void 0, void 0, function* () {
            const item = Object.assign({ [this.pkName]: this.pkValue, [this.skName]: sk }, data);
            if (indices) {
                indices.forEach((index) => {
                    item[index.getPkName()] = index.getPkValue();
                    if (index.getSkValue() !== undefined) {
                        item[index.getSkName()] = index.getSkValue();
                    }
                });
            }
            yield this.db.create({
                TableName: this.tableName,
                Item: item,
            });
            this.cache[sk] = item;
        });
    }
    /**
     * Update an existing item in this partition.
     */
    update(sk, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const current = (yield this.get(sk)) || {};
            const updated = Object.assign(Object.assign({}, current), data);
            yield this.create(sk, updated);
        });
    }
    /**
     * Delete an item by its SK within this partition.
     */
    delete(sk) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.delete({
                TableName: this.tableName,
                Key: {
                    [this.pkName]: this.pkValue,
                    [this.skName]: sk,
                },
            });
            delete this.cache[sk];
        });
    }
    /**
     * Get data for a specific SK within this partition.
     * If the partition is loaded, it returns from cache.
     * Otherwise, it fetches the data immediately.
     */
    get(sk) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cache[sk] !== undefined) {
                return this.cache[sk] || null;
            }
            if (this.isLoaded) {
                return null;
            }
            const response = yield this.db.get({
                TableName: this.tableName,
                Key: {
                    [this.pkName]: this.pkValue,
                    [this.skName]: sk,
                },
            });
            const data = response.Item || null;
            if (data) {
                this.cache[sk] = data;
            }
            return data;
        });
    }
    getPkValue() {
        return this.pkValue;
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
