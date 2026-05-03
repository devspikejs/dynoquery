import { DynoQuery } from "../index";

// Mock the DynamoDBDocumentClient send method
const mockSend = jest.fn();
jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: () => ({
        send: mockSend,
      }),
    },
  };
});

describe("Shorthand Item Access", () => {
  let db: any;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "TestTable",
      models: {
        Product: { pkPrefix: "PRODUCT#" },
      },
    });
  });

  it("should allow getting an Item object directly from the partition model call", async () => {
    mockSend.mockResolvedValue({
      Attributes: { PK: "PRODUCT#p123", SK: "INFO", price: 40 },
    });

    // Shorthand access
    const mouseInfo = db.Product("p123", "INFO");
    
    // It should be an Item object (proxy) with save() method, but NO update() or create()
    expect(mouseInfo.update).toBeUndefined();
    expect(mouseInfo.create).toBeUndefined();
    expect(typeof mouseInfo.save).toBe("function");

    await mouseInfo.save();

    expect(mockSend).toHaveBeenCalled();
    const createCall = mockSend.mock.calls.find(call => {
      const input = call[0].input;
      return input.Item !== undefined;
    });
    expect(createCall).toBeDefined();
    expect(createCall[0].input).toMatchObject({
      TableName: "TestTable",
      Item: {
        PK: "PRODUCT#p123",
        SK: "INFO",
      }
    });
  });

  it("should still return a Partition when only one argument is provided", () => {
    const productPartition = db.Product("p123");
    expect(typeof productPartition.get).toBe("function");
    expect(typeof productPartition.draft).toBe("function");
    expect(productPartition.getPkValue()).toBe("PRODUCT#p123");
  });
});
