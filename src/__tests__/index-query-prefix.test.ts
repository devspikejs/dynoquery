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

describe("IndexQuery pkPrefix", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "TestTable",
      pkPrefix: "GLOBAL#",
      indexes: {
        ByCategory: { 
            indexName: "GSI1", 
            pkName: "GSI1PK", 
            skName: "GSI1SK",
            pkPrefix: "CAT#" 
        }
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should use both global pkPrefix and index pkPrefix", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    const index = (db as any).ByCategory("1");
    await index.query();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ExpressionAttributeValues: { ":pk": "GLOBAL#CAT#1" }
        })
      })
    );
  });

  it("should use global pkPrefix only if index pkPrefix is not provided", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    const db2 = new DynoQuery({
        region: "us-east-1",
        tableName: "TestTable",
        pkPrefix: "GLOBAL#",
        indexes: {
          ByCategory: { 
              indexName: "GSI1", 
              pkName: "GSI1PK", 
              skName: "GSI1SK"
          }
        }
    });
    const mockDocClient2 = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    const mockSend2 = mockDocClient2.send;
    mockSend2.mockResolvedValueOnce({ Items: [] });

    const index2 = (db2 as any).ByCategory("1");
    await index2.query();

    expect(mockSend2).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ExpressionAttributeValues: { ":pk": "GLOBAL#1" }
          })
        })
      );
  });

  it("should use index pkPrefix only if global pkPrefix is not provided", async () => {
    const db3 = new DynoQuery({
        region: "us-east-1",
        tableName: "TestTable",
        indexes: {
          ByCategory: { 
              indexName: "GSI1", 
              pkName: "GSI1PK", 
              skName: "GSI1SK",
              pkPrefix: "CAT#"
          }
        }
    });
    const mockDocClient3 = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    const mockSend3 = mockDocClient3.send;
    mockSend3.mockResolvedValueOnce({ Items: [] });

    const index3 = (db3 as any).ByCategory("1");
    await index3.query();

    expect(mockSend3).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ExpressionAttributeValues: { ":pk": "CAT#1" }
          })
        })
      );
  });
});
