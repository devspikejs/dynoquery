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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Item = exports.DynoQuery = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const partition_1 = require("./partition");
class DynoQuery {
    constructor(config = {}) {
        this.registeredModels = {};
        const { tableName, pkName, skName, pkPrefix, models, findBy } = config, clientConfig = __rest(config, ["tableName", "pkName", "skName", "pkPrefix", "models", "findBy"]);
        this.client = new client_dynamodb_1.DynamoDBClient(clientConfig);
        this.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(this.client, {
            marshallOptions: {
                removeUndefinedValues: true,
            }
        });
        this.defaultTableName = tableName;
        this.globalPkPrefix = pkPrefix || "";
        this.pkName = pkName || "PK";
        this.skName = skName || "SK";
        if (models) {
            this.registeredModels = models;
            Object.entries(models).forEach(([name, def]) => {
                this[name] = (id) => {
                    return new partition_1.Partition(this, { pkPrefix: this.globalPkPrefix + def.pkPrefix }, id);
                };
            });
        }
        if (findBy) {
            const { IndexQuery } = require("./index-query");
            Object.entries(findBy).forEach(([name, def]) => {
                const methodName = `findBy${name}`;
                this[methodName] = (id, skValue) => {
                    return new IndexQuery(this, {
                        indexName: def.indexName,
                        pkName: def.pkName,
                        skName: def.skName,
                        pkPrefix: def.pkPrefix,
                        pkValue: id,
                        skValue: skValue
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
    getRegisteredModels() {
        return this.registeredModels;
    }
}
exports.DynoQuery = DynoQuery;
__exportStar(require("./partition"), exports);
var partition_2 = require("./partition");
Object.defineProperty(exports, "Item", { enumerable: true, get: function () { return partition_2.Item; } });
__exportStar(require("./index-query"), exports);
