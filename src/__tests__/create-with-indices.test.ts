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

describe("Partition.create with indices", () => {
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
        Category: { indexName: "GSI1", pkPrefix: "CAT#" },
        Date: { indexName: "GSI2", pkPrefix: "DATE#" }
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should include index PK and SK when provided in create()", async () => {
    mockSend.mockResolvedValue({});

    const john = (db as any).User("john@example.com");
    const cat = (db as any).findByCategory("USER", "1");
    const date = (db as any).findByDate("2026-10-11", "2");

    await john.create("PROFILE", { 
      name: "John Doe", 
      email: "john@example.com", 
    }, [cat, date]);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "USER#john@example.com",
            SK: "PROFILE",
            name: "John Doe",
            email: "john@example.com",
            GSI1PK: "CAT#USER",
            GSI1SK: "1",
            GSI2PK: "DATE#2026-10-11",
            GSI2SK: "2"
          })
        })
      })
    );
  });

  it("should only include index PK if SK is not provided in findBy", async () => {
    mockSend.mockResolvedValue({});

    const john = (db as any).User("john@example.com");
    const cat = (db as any).findByCategory("USER");

    await john.create("PROFILE", { 
      name: "John Doe",
    }, [cat]);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "USER#john@example.com",
            SK: "PROFILE",
            GSI1PK: "CAT#USER"
          })
        })
      })
    );
    
    const lastCall = mockSend.mock.calls[0][0];
    expect(lastCall.input.Item.GSI1SK).toBeUndefined();
  });
});
