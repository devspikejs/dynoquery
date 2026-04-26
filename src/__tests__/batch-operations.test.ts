import { DynoQuery } from "../index";

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

describe("Batch Operations", () => {
  let db: DynoQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      tableName: "TestTable",
      models: {
        User: { pkPrefix: "USER#" },
        Product: { pkPrefix: "PROD#" },
      },
      findBy: {
        Category: { indexName: "GSI1", pkPrefix: "CAT#" }
      }
    });
  });

  describe("batchWrite", () => {
    it("should process items and send BatchWriteCommand", async () => {
      const user1 = db.User("john", "METADATA");
      user1.name = "John Doe";
      
      const user2 = db.User("jane", "METADATA");
      user2.name = "Jane Doe";

      mockSend.mockResolvedValue({});

      const results = await db.batchWrite([user1, user2]);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            RequestItems: {
              TestTable: [
                {
                  PutRequest: {
                    Item: {
                      PK: "USER#john",
                      SK: "METADATA",
                      name: "John Doe",
                    },
                  },
                },
                {
                  PutRequest: {
                    Item: {
                      PK: "USER#jane",
                      SK: "METADATA",
                      name: "Jane Doe",
                    },
                  },
                },
              ],
            },
          },
        })
      );
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("John Doe");
    });

    it("should handle more than 25 items by chunking", async () => {
      const items = [];
      for (let i = 0; i < 30; i++) {
        const item = db.User(`user${i}`, "METADATA");
        item.val = i;
        items.push(item);
      }

      mockSend.mockResolvedValue({});

      await db.batchWrite(items);

      expect(mockSend).toHaveBeenCalledTimes(2); // 25 + 5
    });
  });

  describe("batchRead", () => {
    it("should process Items and IndexQueries and send BatchGetCommand", async () => {
      const user1Draft = db.User("john", "METADATA");
      const categoryQuery = db.findByCategory("ELECTRONICS", "p123");

      mockSend.mockResolvedValue({
        Responses: {
          TestTable: [
            { PK: "USER#john", SK: "METADATA", name: "John Doe" },
            { PK: "PROD#p123", SK: "INFO", name: "Mouse", GSI1PK: "CAT#ELECTRONICS", GSI1SK: "p123" },
          ],
        },
      });

      const results = await db.batchRead([user1Draft, categoryQuery]);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            RequestItems: {
              TestTable: {
                Keys: [
                  { PK: "USER#john", SK: "METADATA" },
                  { PK: "CAT#ELECTRONICS", SK: "p123" },
                ],
              },
            },
          },
        })
      );

      expect(results).toHaveLength(2);
      // Verify mapping
      const userResult = results.find(r => r.PK === "USER#john");
      expect(userResult.__model).toBe("User");
      expect(typeof userResult.save).toBe("function");

      const prodResult = results.find(r => r.PK === "PROD#p123");
      expect(prodResult.__model).toBe("Product");
    });
  });
});
