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

describe("Pagination", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "TestTable",
      models: {
        User: { pkPrefix: "USER#" }
      },
      findBy: {
        Category: { indexName: "GSI1", pkPrefix: "CAT#" }
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should return LastEvaluatedKey in index queries", async () => {
    const mockItems = [{ PK: "USER#1", SK: "PROFILE", GSI1PK: "CAT#A", GSI1SK: "1" }];
    const mockLastKey = { PK: "USER#1", SK: "PROFILE", GSI1PK: "CAT#A", GSI1SK: "1" };

    mockSend.mockResolvedValueOnce({
      Items: mockItems,
      LastEvaluatedKey: mockLastKey
    });

    const index = (db as any).findByCategory("A");
    const result = await index.getAll({ limit: 1 });

    expect(result.length).toBe(1);
    expect(index.getLastEvaluatedKey()).toBeDefined();
    expect(index.getLastEvaluatedKey()).toEqual(mockLastKey);
  });

  it("should support ExclusiveStartKey in index queries", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const startKey = { PK: "USER#1", SK: "PROFILE", GSI1PK: "CAT#A", GSI1SK: "1" };

    const index = (db as any).findByCategory("A");
    await index.getAll({ exclusiveStartKey: startKey });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ExclusiveStartKey: startKey
        })
      })
    );
  });

  it("should return LastEvaluatedKey in partition.getAll()", async () => {
    const mockItems = [{ PK: "USER#1", SK: "PROFILE", name: "John" }];
    const mockLastKey = { PK: "USER#1", SK: "PROFILE" };

    mockSend.mockResolvedValueOnce({
      Items: mockItems,
      LastEvaluatedKey: mockLastKey
    });

    const user = (db as any).User("1");
    const result = await user.getAll({ limit: 1 });

    expect(result.length).toBe(1);
    expect(user.getLastEvaluatedKey()).toEqual(mockLastKey);
    // Should not mark as loaded if paginated
    expect(user["isLoaded"]).toBe(false);
  });

  it("should support ExclusiveStartKey in partition.getAll()", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const startKey = { PK: "USER#1", SK: "PROFILE" };

    const user = (db as any).User("1");
    await user.getAll({ exclusiveStartKey: startKey });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ExclusiveStartKey: startKey
        })
      })
    );
  });
});
