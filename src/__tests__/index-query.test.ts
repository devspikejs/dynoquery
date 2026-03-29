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

describe("IndexQuery", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "TestTable",
      models: {
        User: { pkPrefix: "USER#" },
        Product: { pkPrefix: "PROD#" }
      },
      findBy: {
        Category: { indexName: "GSI1", pkName: "GSI1PK", skName: "GSI1SK" }
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should get the GSI and map results to models", async () => {
    const mockItems = [
      { PK: "USER#john", SK: "METADATA", GSI1PK: "CAT#1", GSI1SK: "100", name: "John" },
      { PK: "PROD#p1", SK: "INFO", GSI1PK: "CAT#1", GSI1SK: "200", title: "Phone" },
      { PK: "UNKNOWN#1", SK: "DATA", GSI1PK: "CAT#1", GSI1SK: "300", val: "foo" }
    ];

    mockSend.mockResolvedValueOnce({ Items: mockItems });
    const index = (db as any).findByCategory("CAT#1");
    const results = await index.getAll();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "TestTable",
          IndexName: "GSI1",
          KeyConditionExpression: "#pk = :pk",
          ExpressionAttributeNames: { "#pk": "GSI1PK" },
          ExpressionAttributeValues: { ":pk": "CAT#1" }
        })
      })
    );

    expect(results.length).toBe(3);
    expect(results[0].__model).toBe("User");
    expect(results[1].__model).toBe("Product");
    expect(results[2].__model).toBeUndefined();

    // Test getPartition helper
    const userPartition = results[0].getPartition();
    expect(userPartition.getPkValue()).toBe("USER#john");

    // Test IndexQuery.get
    // We need to mock the send call for the get() as well because it's a separate call
    mockSend.mockResolvedValueOnce({ Items: [mockItems[0]] });
    const singleUser = await index.get("100");
    expect(singleUser.__model).toBe("User");
    expect(singleUser.name).toBe("John");

    // Verify that the partition is already cached with the item data
    // This should not trigger another DB call
    const cachedData = await userPartition.get("METADATA");
    expect(cachedData.name).toBe("John");
    expect(mockSend).toHaveBeenCalledTimes(2); // One for getAll, one for get
  });

  it("should support begins_with on SK via get", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const index = (db as any).findByCategory("CAT#1");
    await index.get("1");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
          ExpressionAttributeNames: expect.objectContaining({
            "#pk": "GSI1PK",
            "#sk": "GSI1SK"
          }),
          ExpressionAttributeValues: expect.objectContaining({
            ":pk": "CAT#1",
            ":sk": "1"
          })
        })
      })
    );
  });

  it("should support getAll", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const index = (db as any).findByCategory("CAT#1");
    await index.getAll();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "#pk = :pk",
          ExpressionAttributeNames: { "#pk": "GSI1PK" },
          ExpressionAttributeValues: { ":pk": "CAT#1" }
        })
      })
    );
  });

  it("should support limit in options object", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const index = (db as any).findByCategory("CAT#1");
    await index.getAll({ limit: 10 });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "#pk = :pk",
          Limit: 10
        })
      })
    );
  });
});
