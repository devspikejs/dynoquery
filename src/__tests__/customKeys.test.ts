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

describe("Custom Key Names Support", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "CustomTable",
      pkName: "partition_key",
      skName: "sort_key",
      partitions: {
        User: { pkPrefix: "USER#" }
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should use custom key names in Model operations", async () => {
    const john = (db as any).User("john@example.com");

    // Test get/find
    mockSend.mockResolvedValueOnce({ Item: { partition_key: "USER#john@example.com", sort_key: "METADATA", name: "John" } });
    await john.get("METADATA");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Key: {
            partition_key: "USER#john@example.com",
            sort_key: "METADATA"
          }
        })
      })
    );

    // Test create/save
    mockSend.mockResolvedValueOnce({});
    await john.create("PROFILE", { name: "John Doe" });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            partition_key: "USER#john@example.com",
            sort_key: "PROFILE",
            name: "John Doe"
          })
        })
      })
    );
  });

  it("should use custom key names in Partition.getAll()", async () => {
    const john = (db as any).User("john@example.com");

    mockSend.mockResolvedValueOnce({
      Items: [
        { partition_key: "USER#john@example.com", sort_key: "METADATA", email: "john@example.com" }
      ]
    });

    await john.getAll();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "#pk = :pk",
          ExpressionAttributeNames: {
            "#pk": "partition_key"
          }
        })
      })
    );

    // Verify cache was populated using custom skName
    const data = await john.get("METADATA");
    expect(data.email).toBe("john@example.com");
    expect(mockSend).toHaveBeenCalledTimes(1); // Should not call again for get
  });

  it("should use custom key names in Partition.deleteAll()", async () => {
    const john = (db as any).User("john@example.com");

    mockSend
      .mockResolvedValueOnce({
        Items: [
          { partition_key: "USER#john@example.com", sort_key: "METADATA" }
        ]
      })
      .mockResolvedValueOnce({}); // batchWrite

    await john.deleteAll();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          RequestItems: expect.objectContaining({
            "CustomTable": expect.arrayContaining([
              expect.objectContaining({
                DeleteRequest: {
                  Key: {
                    partition_key: "USER#john@example.com",
                    sort_key: "METADATA"
                  }
                }
              })
            ])
          })
        })
      })
    );
  });
});
