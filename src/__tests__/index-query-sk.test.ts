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

describe("IndexQuery with SK value", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "TestTable",
      findBy: {
        Category: { indexName: "GSI1", pkPrefix: "CAT#" }
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should store skValue when passed to findBy", () => {
    const cat = (db as any).findByCategory("USER", "1");
    expect(cat.getSkValue()).toBe("1");
    expect(cat.getPkValue()).toBe("CAT#USER");
  });

  it("should use stored skValue in get() if none provided", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const cat = (db as any).findByCategory("USER", "1");
    await cat.get();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
          ExpressionAttributeValues: {
            ":pk": "CAT#USER",
            ":sk": "1"
          }
        })
      })
    );
  });

  it("should override stored skValue if one is passed to get()", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const cat = (db as any).findByCategory("USER", "1");
    await cat.get("override");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
          ExpressionAttributeValues: {
            ":pk": "CAT#USER",
            ":sk": "override"
          }
        })
      })
    );
  });

  it("should use stored skValue in getAll()", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const cat = (db as any).findByCategory("USER", "1");
    await cat.getAll();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
          ExpressionAttributeValues: {
            ":pk": "CAT#USER",
            ":sk": "1"
          }
        })
      })
    );
  });
});
