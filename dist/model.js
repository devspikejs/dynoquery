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
exports.Model = void 0;
class Model {
    constructor(db, config) {
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
    getTableName() {
        return this.tableName;
    }
    getPK(id = "") {
        return `${this.pkPrefix}${id}`;
    }
    /**
     * Find an item by its identifier (part of the PK).
     * Assumes the SK is fixed as defined in ModelConfig.
     */
    find() {
        return __awaiter(this, arguments, void 0, function* (id = "") {
            const response = yield this.db.get({
                TableName: this.getTableName(),
                Key: {
                    [this.pkName]: this.getPK(id),
                    [this.skName]: this.skValue,
                },
            });
            return response.Item || null;
        });
    }
    /**
     * Save an item.
     */
    save(data_1) {
        return __awaiter(this, arguments, void 0, function* (data, id = "") {
            const item = Object.assign({ [this.pkName]: this.getPK(id), [this.skName]: this.skValue }, data);
            yield this.db.create({
                TableName: this.getTableName(),
                Item: item,
            });
            if (this.onUpdate) {
                this.onUpdate(this.skValue, item);
            }
        });
    }
    /**
     * Update an existing item.
     */
    update(data_1) {
        return __awaiter(this, arguments, void 0, function* (data, id = "") {
            // For simplicity in this wrapper, we use create (PutItem) to update the whole item
            // but the user might expect a partial update if we use UpdateCommand.
            // However, for single table and this kind of wrapper, often we just put the whole item.
            // If we want to support partial updates in the cache, we need the current item.
            const response = yield this.db.get({
                TableName: this.getTableName(),
                Key: {
                    [this.pkName]: this.getPK(id),
                    [this.skName]: this.skValue,
                },
            });
            const current = response.Item || {};
            const updated = Object.assign(Object.assign({}, current), data);
            yield this.save(updated, id);
        });
    }
    /**
     * Delete an item by its identifier.
     */
    remove() {
        return __awaiter(this, arguments, void 0, function* (id = "") {
            yield this.db.delete({
                TableName: this.getTableName(),
                Key: {
                    [this.pkName]: this.getPK(id),
                    [this.skName]: this.skValue,
                },
            });
            if (this.onUpdate) {
                this.onUpdate(this.skValue, null);
            }
        });
    }
}
exports.Model = Model;
