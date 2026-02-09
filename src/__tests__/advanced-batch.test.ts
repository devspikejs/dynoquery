import { DynoQuery } from "../index";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Mock the AWS SDK
jest.mock("@aws-sdk/client-dynamodb");
jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({
        send: jest.fn(),
      }),
    },
  };
});

describe("Advanced Batch Get Support", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "TestTable",
      partitions: {
        User: { pkPrefix: "USER#" },
      },
      indexes: {
        ByCategory: { indexName: "GSI1", pkName: "GSI1PK", skName: "GSI1SK", pkPrefix: "CAT#" }
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should support batchGetInput from Partition", () => {
    const john = (db as any).User("john@example.com");
    
    const singleInput = john.batchGetInput("METADATA");
    expect(singleInput).toEqual([{ TableName: "TestTable", Key: { PK: "USER#john@example.com", SK: "METADATA" } }]);

    const multipleInput = john.batchGetInput("METADATA", "PROFILE");
    expect(multipleInput).toEqual([
      { TableName: "TestTable", Key: { PK: "USER#john@example.com", SK: "METADATA" } },
      { TableName: "TestTable", Key: { PK: "USER#john@example.com", SK: "PROFILE" } }
    ]);

    const allInput = john.batchGetInput();
    expect(allInput).toEqual([{ TableName: "TestTable", Key: { PK: "USER#john@example.com" } }]);
  });

  it("should support batchGetInput from IndexQuery", () => {
    const cat = (db as any).ByCategory("1");
    
    const singleInput = cat.batchGetInput("100");
    expect(singleInput).toEqual([{ TableName: "TestTable", Key: { GSI1PK: "CAT#1", GSI1SK: "100" } }]);

    const multipleInput = cat.batchGetInput("100", "200");
    expect(multipleInput).toEqual([
      { TableName: "TestTable", Key: { GSI1PK: "CAT#1", GSI1SK: "100" } },
      { TableName: "TestTable", Key: { GSI1PK: "CAT#1", GSI1SK: "200" } }
    ]);

    const allInput = cat.batchGetInput();
    expect(allInput).toEqual([{ TableName: "TestTable", Key: { GSI1PK: "CAT#1" } }]);
  });

  it("should support batchWriteInput from Partition", () => {
    const john = (db as any).User("john@example.com");
    const input = john.batchWriteInput({ SK: "METADATA", name: "John" });
    expect(input).toEqual([{
      TableName: "TestTable",
      PutRequest: {
        Item: { PK: "USER#john@example.com", SK: "METADATA", name: "John" }
      }
    }]);
  });

  it("should support batchDeleteInput from Partition", () => {
    const john = (db as any).User("john@example.com");
    const input = john.batchDeleteInput("METADATA");
    expect(input).toEqual([{
      TableName: "TestTable",
      DeleteRequest: {
        Key: { PK: "USER#john@example.com", SK: "METADATA" }
      }
    }]);
  });

  it("should support batchWriteInput from IndexQuery", () => {
    const cat = (db as any).ByCategory("1");
    const input = cat.batchWriteInput({ GSI1SK: "100", name: "Category 1" });
    expect(input).toEqual([{
      TableName: "TestTable",
      PutRequest: {
        Item: { GSI1PK: "CAT#1", GSI1SK: "100", name: "Category 1" }
      }
    }]);
  });

  it("should support batchDeleteInput from IndexQuery", () => {
    const cat = (db as any).ByCategory("1");
    const input = cat.batchDeleteInput("100");
    expect(input).toEqual([{
      TableName: "TestTable",
      DeleteRequest: {
        Key: { GSI1PK: "CAT#1", GSI1SK: "100" }
      }
    }]);
  });

  it("should support batchGet with multiple item arrays", async () => {
    mockSend.mockResolvedValueOnce({ Responses: { TestTable: [] } });

    const john = (db as any).User("john@example.com");
    const cat = (db as any).ByCategory("1");

    const batchItem1 = john.batchGetInput("METADATA");
    const batchOthers = cat.batchGetInput("100", "200");
    const batchCat = cat.batchGetInput();

    await db.batchGet(batchItem1, batchOthers, batchCat);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          RequestItems: expect.objectContaining({
            TestTable: expect.objectContaining({
              Keys: [
                { PK: "USER#john@example.com", SK: "METADATA" },
                { GSI1PK: "CAT#1", GSI1SK: "100" },
                { GSI1PK: "CAT#1", GSI1SK: "200" },
                { GSI1PK: "CAT#1" }
              ]
            })
          })
        })
      })
    );
  });
});
