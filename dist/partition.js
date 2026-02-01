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
const model_1 = require("./model");
class Partition {
    constructor(db, config, id) {
        this.cache = {};
        this.isLoaded = false;
        this.db = db;
        this.tableName = config.tableName || db.getTableName();
        this.pkName = db.getPkName();
        this.skName = db.getSkName();
        if (config.pk) {
            this.pk = config.pk;
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
                this.pk = `${finalPrefix}${id || ""}`;
            }
            else {
                throw new Error("Either pk or pkPrefix must be provided in PartitionConfig");
            }
        }
        if (!this.tableName) {
            throw new Error("TableName must be provided in PartitionConfig or DynoQueryConfig");
        }
    }
    /**
     * Load all data for this partition key.
     */
    loadAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.db.query({
                TableName: this.tableName,
                KeyConditionExpression: "#pk = :pk",
                ExpressionAttributeNames: {
                    "#pk": this.pkName,
                },
                ExpressionAttributeValues: {
                    ":pk": this.pk,
                },
            });
            if (response.Items) {
                response.Items.forEach((item) => {
                    if (item[this.skName]) {
                        this.cache[item[this.skName]] = item;
                    }
                });
            }
            this.isLoaded = true;
            return this;
        });
    }
    /**
     * Get a model instance for a specific SK within this partition.
     */
    model(sk) {
        const config = {
            tableName: this.tableName,
            pkPrefix: this.pk, // In this context, pk is fixed, so prefix is the full PK
            skValue: sk,
            onUpdate: (updatedSk, data) => {
                if (data === null) {
                    delete this.cache[updatedSk];
                }
                else {
                    this.cache[updatedSk] = data;
                }
            }
        };
        return new model_1.Model(this.db, config);
    }
    getPK() {
        return this.pk;
    }
    /**
     * Create an item in this partition and return the model.
     */
    create(sk, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const m = this.model(sk);
            yield m.save(data);
            return m;
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
            const model = this.model(sk);
            const data = yield model.find();
            if (data) {
                this.cache[sk] = data;
            }
            return data;
        });
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
                    ":pk": this.pk,
                },
            });
            if (response.Items && response.Items.length > 0) {
                // DynamoDB BatchWriteItem supports up to 25 requests at once
                const items = response.Items;
                const chunks = [];
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
                    yield this.db.batchWrite({
                        RequestItems: {
                            [this.tableName]: deleteRequests,
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
