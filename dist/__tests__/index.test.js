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
const index_1 = require("../index");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
// Mock the AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb', () => {
    const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
    return Object.assign(Object.assign({}, actual), { DynamoDBDocumentClient: {
            from: jest.fn().mockReturnValue({
                send: jest.fn(),
            }),
        } });
});
describe('DynoQuery', () => {
    let dynoQuery;
    let mockDocClient;
    beforeEach(() => {
        dynoQuery = new index_1.DynoQuery({ region: 'us-east-1' });
        mockDocClient = lib_dynamodb_1.DynamoDBDocumentClient.from.mock.results[0].value;
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    test('create should call PutCommand', () => __awaiter(void 0, void 0, void 0, function* () {
        const params = { TableName: 'TestTable', Item: { id: '1', name: 'Test' } };
        yield dynoQuery.create(params);
        expect(mockDocClient.send).toHaveBeenCalled();
    }));
    test('get should call GetCommand', () => __awaiter(void 0, void 0, void 0, function* () {
        const params = { TableName: 'TestTable', Key: { id: '1' } };
        yield dynoQuery.get(params);
        expect(mockDocClient.send).toHaveBeenCalled();
    }));
    test('update should call UpdateCommand', () => __awaiter(void 0, void 0, void 0, function* () {
        const params = {
            TableName: 'TestTable',
            Key: { id: '1' },
            UpdateExpression: 'set #n = :n',
            ExpressionAttributeNames: { '#n': 'name' },
            ExpressionAttributeValues: { ':n': 'Updated' },
        };
        yield dynoQuery.update(params);
        expect(mockDocClient.send).toHaveBeenCalled();
    }));
    test('delete should call DeleteCommand', () => __awaiter(void 0, void 0, void 0, function* () {
        const params = { TableName: 'TestTable', Key: { id: '1' } };
        yield dynoQuery.delete(params);
        expect(mockDocClient.send).toHaveBeenCalled();
    }));
    test('query should call QueryCommand', () => __awaiter(void 0, void 0, void 0, function* () {
        const params = {
            TableName: 'TestTable',
            KeyConditionExpression: 'id = :id',
            ExpressionAttributeValues: { ':id': '1' },
        };
        yield dynoQuery.query(params);
        expect(mockDocClient.send).toHaveBeenCalled();
    }));
    test('scan should call ScanCommand', () => __awaiter(void 0, void 0, void 0, function* () {
        const params = { TableName: 'TestTable' };
        yield dynoQuery.scan(params);
        expect(mockDocClient.send).toHaveBeenCalled();
    }));
    test('batchGet should call BatchGetCommand', () => __awaiter(void 0, void 0, void 0, function* () {
        const params = {
            RequestItems: {
                TestTable: {
                    Keys: [{ id: '1' }, { id: '2' }],
                },
            },
        };
        yield dynoQuery.batchGet(params);
        expect(mockDocClient.send).toHaveBeenCalled();
    }));
    test('batchWrite should call BatchWriteCommand', () => __awaiter(void 0, void 0, void 0, function* () {
        const params = {
            RequestItems: {
                TestTable: [
                    { PutRequest: { Item: { id: '1', name: 'Test1' } } },
                    { PutRequest: { Item: { id: '2', name: 'Test2' } } },
                ],
            },
        };
        yield dynoQuery.batchWrite(params);
        expect(mockDocClient.send).toHaveBeenCalled();
    }));
});
