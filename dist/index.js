"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
exports.DynoQuery = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const partition_1 = require("./partition");
class DynoQuery {
    constructor(config = {}) {
        this.registeredPartitions = {};
        const clientConfig = Object.assign({}, config);
        // Remove properties that are not part of DynamoDBClientConfig
        delete clientConfig.tableName;
        delete clientConfig.pkPrefix;
        delete clientConfig.partitions;
        delete clientConfig.indexes;
        delete clientConfig.pkName;
        delete clientConfig.skName;
        this.client = new client_dynamodb_1.DynamoDBClient(clientConfig);
        this.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(this.client, {
            marshallOptions: {
                removeUndefinedValues: true,
            }
        });
        this.defaultTableName = config.tableName;
        this.globalPkPrefix = config.pkPrefix || "";
        this.pkName = config.pkName || "PK";
        this.skName = config.skName || "SK";
        if (config.partitions) {
            this.registeredPartitions = config.partitions;
            Object.entries(config.partitions).forEach(([name, def]) => {
                this[name] = (id) => {
                    return new partition_1.Partition(this, { pkPrefix: this.globalPkPrefix + def.pkPrefix }, id);
                };
            });
        }
        if (config.indexes) {
            const { IndexQuery } = require("./index-query");
            Object.entries(config.indexes).forEach(([name, def]) => {
                this[name] = (id) => {
                    return new IndexQuery(this, {
                        indexName: def.indexName,
                        pkName: def.pkName,
                        skName: def.skName,
                        pkPrefix: def.pkPrefix,
                        pkValue: id
                    });
                };
            });
        }
    }
    /**
     * Create or replace an item in the table.
     */
    create(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!params.TableName && this.defaultTableName) {
                params.TableName = this.defaultTableName;
            }
            const command = new lib_dynamodb_1.PutCommand(params);
            return yield this.docClient.send(command);
        });
    }
    /**
     * Get an item by its primary key.
     */
    get(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!params.TableName && this.defaultTableName) {
                params.TableName = this.defaultTableName;
            }
            const command = new lib_dynamodb_1.GetCommand(params);
            return yield this.docClient.send(command);
        });
    }
    /**
     * Update an existing item.
     */
    update(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!params.TableName && this.defaultTableName) {
                params.TableName = this.defaultTableName;
            }
            const command = new lib_dynamodb_1.UpdateCommand(params);
            return yield this.docClient.send(command);
        });
    }
    /**
     * Delete an item by its primary key.
     */
    delete(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!params.TableName && this.defaultTableName) {
                params.TableName = this.defaultTableName;
            }
            const command = new lib_dynamodb_1.DeleteCommand(params);
            return yield this.docClient.send(command);
        });
    }
    /**
     * Query items based on primary key and sort key conditions.
     */
    query(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!params.TableName && this.defaultTableName) {
                params.TableName = this.defaultTableName;
            }
            const command = new lib_dynamodb_1.QueryCommand(params);
            return yield this.docClient.send(command);
        });
    }
    /**
     * Scan the table or index for items.
     */
    scan(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!params.TableName && this.defaultTableName) {
                params.TableName = this.defaultTableName;
            }
            const command = new lib_dynamodb_1.ScanCommand(params);
            return yield this.docClient.send(command);
        });
    }
    /**
     * Get multiple items by their primary keys.
     */
    batchGet(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.defaultTableName && params.RequestItems) {
                // Note: Batch operations are a bit trickier because TableName is a key in RequestItems
                // This wrapper doesn't automatically add it to RequestItems yet,
                // but let's see if we should handle it.
                // For now, let's keep it as is or add it if RequestItems is empty?
                // Usually BatchGetCommandInput is complex.
            }
            const command = new lib_dynamodb_1.BatchGetCommand(params);
            return yield this.docClient.send(command);
        });
    }
    /**
     * Put or delete multiple items in one or more tables.
     */
    batchWrite(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const command = new lib_dynamodb_1.BatchWriteCommand(params);
            return yield this.docClient.send(command);
        });
    }
    getTableName() {
        return this.defaultTableName;
    }
    getPkPrefix() {
        return this.globalPkPrefix;
    }
    getPkName() {
        return this.pkName;
    }
    getSkName() {
        return this.skName;
    }
    getRegisteredPartitions() {
        return this.registeredPartitions;
    }
}
exports.DynoQuery = DynoQuery;
__exportStar(require("./model"), exports);
__exportStar(require("./partition"), exports);
__exportStar(require("./index-query"), exports);
