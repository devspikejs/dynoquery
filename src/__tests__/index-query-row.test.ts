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

describe("IndexQuery Item Save", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "TestTable",
      models: {
        User: { pkPrefix: "USER#" },
      },
      findBy: {
        Category: { indexName: "GSI1", pkName: "GSI1PK", skName: "GSI1SK" }
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should allow editing and saving an item returned by IndexQuery", async () => {
    const mockItems = [
      { PK: "USER#john", SK: "METADATA", GSI1PK: "CAT#1", GSI1SK: "100", name: "John" },
    ];

    mockSend.mockResolvedValueOnce({ Items: mockItems });
    const index = (db as any).findByCategory("CAT#1");
    const results = await index.getAll();

    const userRow = results[0];
    expect(userRow.__model).toBe("User");
    expect(userRow.name).toBe("John");
    expect(typeof userRow.save).toBe("function");

    // Edit property
    userRow.name = "John Updated";

    // Mock response for the get (which is called inside update)
    // Actually, Item.save calls partition.update, which calls asyncGet.
    // In our case, partition.cache[SK] was pre-filled in mapItemToModel, so asyncGet returns from cache.
    // partition.update then calls partition.create, which calls db.create.

    mockSend.mockResolvedValueOnce({}); // for db.create

    await userRow.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "TestTable",
          Item: expect.objectContaining({
            PK: "USER#john",
            SK: "METADATA",
            name: "John Updated",
            GSI1PK: "CAT#1",
            GSI1SK: "100"
          })
        })
      })
    );

    // Verify that __model and getPartition are still there
    expect(userRow.__model).toBe("User");
    expect(typeof userRow.getPartition).toBe("function");
    expect(userRow.getPartition().getPkValue()).toBe("USER#john");
  });
});
