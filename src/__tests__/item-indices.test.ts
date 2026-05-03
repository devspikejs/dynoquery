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

describe("Item Indices Support", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "TestTable",
      models: {
        Product: { pkPrefix: "PROD#" }
      },
      findBy: {
        Category: { indexName: "GSI1", pkName: "GSI1PK", skName: "GSI1SK" }
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should support indices in partition.update()", async () => {
    const electronics = (db as any).findByCategory("ELECTRONICS", "RANK#1");
    const product = db.Product("p123");

    // Mock get for update
    mockSend.mockResolvedValueOnce({ Item: { PK: "PROD#p123", SK: "INFO", name: "Old Name" } });
    mockSend.mockResolvedValueOnce({}); // for create/put

    await product.update("INFO", { name: "Gaming Mouse" }, [electronics]);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "PROD#p123",
            SK: "INFO",
            name: "Gaming Mouse",
            GSI1PK: "ELECTRONICS",
            GSI1SK: "RANK#1"
          })
        })
      })
    );
  });

  it("should support setIndex() and save()", async () => {
    const electronics = (db as any).findByCategory("ELECTRONICS", "RANK#1");
    const mouse = db.Product("p123").draft("INFO");

    mouse.name = "Gaming Mouse";
    mouse.setIndex(electronics);

    // Mock get for save (which calls update)
    mockSend.mockResolvedValueOnce({ Item: { PK: "PROD#p123", SK: "INFO" } });
    mockSend.mockResolvedValueOnce({}); // for create/put

    await mouse.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "PROD#p123",
            SK: "INFO",
            name: "Gaming Mouse",
            GSI1PK: "ELECTRONICS",
            GSI1SK: "RANK#1"
          })
        })
      })
    );
  });

  it("should support multiple indices via setIndex()", async () => {
    const catIdx = (db as any).findByCategory("ELECTRONICS", "RANK#1");
    // Add another dummy index for testing
    const statusIdx = {
        getPkName: () => "GSI2PK",
        getPkValue: () => "STATUS#ACTIVE",
        getSkName: () => "GSI2SK",
        getSkValue: () => "PROD#p123"
    };

    const mouse = db.Product("p123").draft("INFO");
    mouse.setIndex([catIdx, statusIdx as any]);

    // Mock get for save
    mockSend.mockResolvedValueOnce({ Item: { PK: "PROD#p123", SK: "INFO" } });
    mockSend.mockResolvedValueOnce({});

    await mouse.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            GSI1PK: "ELECTRONICS",
            GSI1SK: "RANK#1",
            GSI2PK: "STATUS#ACTIVE",
            GSI2SK: "PROD#p123"
          })
        })
      })
    );
  });
});
