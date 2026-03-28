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

describe("DynoQuery Partition Registry", () => {
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
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should allow calling db.User(id) and return data immediately with get()", async () => {
    const john = (db as any).User("john@example.com");
    expect(john).toBeDefined();
    expect(john.get).toBeDefined();

    mockSend.mockResolvedValueOnce({ Item: { name: "John" } });

    const data = await john.get("METADATA");
    expect(data.name).toBe("John");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Key: {
            PK: "USER#john@example.com",
            SK: "METADATA"
          }
        })
      })
    );
  });

  it("should allow calling db.Product(id) and use getAll()", async () => {
    const prod = (db as any).Product("p123");

    mockSend.mockResolvedValueOnce({ Items: [{ PK: "PROD#p123", SK: "INFO", price: 100 }] });
    await prod.getAll();

    const data = await prod.get("INFO");
    expect(data.price).toBe(100);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
