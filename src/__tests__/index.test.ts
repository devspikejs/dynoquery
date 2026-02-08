import { DynoQuery } from '../index';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({
        send: jest.fn(),
      }),
    },
  };
});

describe('DynoQuery', () => {
  let dynoQuery: DynoQuery;
  let mockDocClient: any;

  beforeEach(() => {
    dynoQuery = new DynoQuery({ region: 'us-east-1' });
    mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('create should call PutCommand', async () => {
    const params = { TableName: 'TestTable', Item: { id: '1', name: 'Test' } };
    await dynoQuery.create(params);
    expect(mockDocClient.send).toHaveBeenCalled();
  });

  test('create should use default TableName if not provided', async () => {
    const dynoWithTable = new DynoQuery({ region: 'us-east-1', tableName: 'DefaultTable' });
    const mockDocClientWithTable = (DynamoDBDocumentClient.from as jest.Mock).mock.results[(DynamoDBDocumentClient.from as jest.Mock).mock.results.length - 1].value;

    await dynoWithTable.create({ Item: { id: '1' } } as any);

    expect(mockDocClientWithTable.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'DefaultTable'
        })
      })
    );
  });

  test('get should call GetCommand', async () => {
    const params = { TableName: 'TestTable', Key: { id: '1' } };
    await dynoQuery.get(params);
    expect(mockDocClient.send).toHaveBeenCalled();
  });

  test('update should call UpdateCommand', async () => {
    const params = {
      TableName: 'TestTable',
      Key: { id: '1' },
      UpdateExpression: 'set #n = :n',
      ExpressionAttributeNames: { '#n': 'name' },
      ExpressionAttributeValues: { ':n': 'Updated' },
    };
    await dynoQuery.update(params);
    expect(mockDocClient.send).toHaveBeenCalled();
  });

  test('delete should call DeleteCommand', async () => {
    const params = { TableName: 'TestTable', Key: { id: '1' } };
    await dynoQuery.delete(params);
    expect(mockDocClient.send).toHaveBeenCalled();
  });

  test('get should call QueryCommand', async () => {
    const params = {
      TableName: 'TestTable',
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: { ':id': '1' },
    };
    await dynoQuery.query(params);
    expect(mockDocClient.send).toHaveBeenCalled();
  });

  test('scan should call ScanCommand', async () => {
    const params = { TableName: 'TestTable' };
    await dynoQuery.scan(params);
    expect(mockDocClient.send).toHaveBeenCalled();
  });

  test('batchGet should call BatchGetCommand', async () => {
    const params = {
      RequestItems: {
        TestTable: {
          Keys: [{ id: '1' }, { id: '2' }],
        },
      },
    };
    await dynoQuery.batchGet(params);
    expect(mockDocClient.send).toHaveBeenCalled();
  });

  test('batchWrite should call BatchWriteCommand', async () => {
    const params = {
      RequestItems: {
        TestTable: [
          { PutRequest: { Item: { id: '1', name: 'Test1' } } },
          { PutRequest: { Item: { id: '2', name: 'Test2' } } },
        ],
      },
    };
    await dynoQuery.batchWrite(params);
    expect(mockDocClient.send).toHaveBeenCalled();
  });
});
