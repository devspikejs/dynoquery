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

describe("Batch Operations with Default TableName", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "DefaultTable",
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should support batchGet with Items property (auto-inject TableName)", async () => {
    mockSend.mockResolvedValueOnce({ Responses: { DefaultTable: [] } });

    await db.batchGet({
      Items: [{ PK: "USER#1", SK: "METADATA" }],
    } as any);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          RequestItems: expect.objectContaining({
            DefaultTable: expect.objectContaining({
              Keys: [{ PK: "USER#1", SK: "METADATA" }],
            }),
          }),
        }),
      })
    );
  });

  it("should support batchWrite with Items property (auto-inject TableName and PutRequest)", async () => {
    mockSend.mockResolvedValueOnce({});

    await db.batchWrite({
      Items: [
        { PK: "USER#1", SK: "METADATA", name: "John" },
      ],
    } as any);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          RequestItems: expect.objectContaining({
            DefaultTable: expect.arrayContaining([
              expect.objectContaining({
                PutRequest: expect.objectContaining({
                  Item: { PK: "USER#1", SK: "METADATA", name: "John" },
                }),
              }),
            ]),
          }),
        }),
      })
    );
  });
});
