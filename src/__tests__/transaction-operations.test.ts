import { DynoQuery, attr } from "../index";

// Mock DynamoDBDocumentClient
const mockSend = jest.fn();
jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: () => ({
        send: (...args: any[]) => mockSend(...args),
      }),
    },
  };
});

describe("Transaction Operations", () => {
  let db: DynoQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      tableName: "TestTable",
      models: {
        User: { pkPrefix: "USER#" },
        Product: { pkPrefix: "PROD#" },
      },
    });
  });

  describe("transactWrite", () => {
    it("should process items and send TransactWriteCommand", async () => {
      const user1 = db.User("john", "METADATA");
      user1.name = "John Doe";
      
      const user2 = db.User("jane", "METADATA");
      user2.name = "Jane Doe";

      const userToDelete = db.User("olduser").draftDelete("METADATA");

      mockSend.mockResolvedValue({});

      await db.transactWrite([user1, user2, userToDelete]);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TransactItems: [
              {
                Put: {
                  TableName: "TestTable",
                  Item: {
                    PK: "USER#john",
                    SK: "METADATA",
                    name: "John Doe",
                  },
                },
              },
              {
                Put: {
                  TableName: "TestTable",
                  Item: {
                    PK: "USER#jane",
                    SK: "METADATA",
                    name: "Jane Doe",
                  },
                },
              },
              {
                Delete: {
                  TableName: "TestTable",
                  Key: {
                    PK: "USER#olduser",
                    SK: "METADATA",
                  },
                },
              },
            ],
          },
        })
      );
    });

    it("should handle condition expressions in transactWrite", async () => {
      const user = db.User("john", "METADATA");
      user.name = "John Doe";
      user.setCondition(attr("version").exists());

      mockSend.mockResolvedValue({});

      await db.transactWrite([user]);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TransactItems: [
              {
                Put: {
                  TableName: "TestTable",
                  Item: {
                    PK: "USER#john",
                    SK: "METADATA",
                    name: "John Doe",
                  },
                  ConditionExpression: "attribute_exists(#n0)",
                  ExpressionAttributeNames: { "#n0": "version" },
                  ExpressionAttributeValues: {},
                },
              },
            ],
          },
        })
      );
    });

    it("should handle condition expressions in delete in transactWrite", async () => {
        const user = db.User("john").draftDelete("METADATA");
        user.setCondition(attr("status").equals("ACTIVE"));
  
        mockSend.mockResolvedValue({});
  
        await db.transactWrite([user]);
  
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            input: {
              TransactItems: [
                {
                  Delete: {
                    TableName: "TestTable",
                    Key: {
                      PK: "USER#john",
                      SK: "METADATA",
                    },
                    ConditionExpression: "#n0 = :v0",
                    ExpressionAttributeNames: { "#n0": "status" },
                    ExpressionAttributeValues: { ":v0": "ACTIVE" },
                  },
                },
              ],
            },
          })
        );
      });
  });

  describe("transactRead", () => {
    it("should process items and send TransactGetCommand", async () => {
      const user1Draft = db.User("john", "METADATA");
      const user2Draft = db.User("jane", "METADATA");

      mockSend.mockResolvedValue({
        Responses: [
          { Item: { PK: "USER#john", SK: "METADATA", name: "John Doe" } },
          { Item: { PK: "USER#jane", SK: "METADATA", name: "Jane Doe" } },
        ],
      });

      const results = await db.transactRead([user1Draft, user2Draft]);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TransactItems: [
              { Get: { TableName: "TestTable", Key: { PK: "USER#john", SK: "METADATA" } } },
              { Get: { TableName: "TestTable", Key: { PK: "USER#jane", SK: "METADATA" } } },
            ],
          },
        })
      );

      expect(results).toHaveLength(2);
      expect(results[0].__model).toBe("User");
      expect(results[1].__model).toBe("User");
      expect(results[0].name).toBe("John Doe");
    });

    it("should return null for missing items in transactRead", async () => {
        const userDraft = db.User("missing", "METADATA");
  
        mockSend.mockResolvedValue({
          Responses: [
            {},
          ],
        });
  
        const results = await db.transactRead([userDraft]);
  
        expect(results).toHaveLength(1);
        expect(results[0]).toBeNull();
      });
  });
});
