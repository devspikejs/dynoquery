import { DynoQuery } from "../index";
import { Partition } from "../partition";
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

describe("Multitenancy Support", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "MultitenantTable",
      pkPrefix: "TENANT#A#", // Global prefix for all partitions
      partitions: {
        User: { pkPrefix: "USER#" }
      }
    });
    const mockDocClient = (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value;
    mockSend = mockDocClient.send;
  });

  it("should prepend global pkPrefix to registered partitions", async () => {
    const john = (db as any).User("john@example.com");

    mockSend.mockResolvedValueOnce({ Item: { name: "John" } });

    await john.get("METADATA");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Key: {
            PK: "TENANT#A#USER#john@example.com",
            SK: "METADATA"
          }
        })
      })
    );
  });

  it("should prepend global pkPrefix to manually created partitions", async () => {
    const manualPartition = new Partition(db, { pkPrefix: "ORG#1#" }, "DEPT#5");

    mockSend.mockResolvedValueOnce({ Item: { name: "HR" } });
    await manualPartition.get("INFO");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Key: {
            PK: "TENANT#A#ORG#1#DEPT#5",
            SK: "INFO"
          }
        })
      })
    );
  });

  it("should not double-prepend if partition prefix already starts with global prefix", async () => {
     // This test ensures that if we pass something that already has the prefix, we don't double it.
     // In the DynoQuery constructor, we do: this.globalPkPrefix + def.pkPrefix
     // So db.User('id') will have pkPrefix = "TENANT#A#USER#"
     // Then Partition constructor sees it starts with TENANT#A#, so it doesn't prepend again.
     const john = (db as any).User("john@example.com");

     mockSend.mockResolvedValueOnce({ Item: { name: "John" } });
     await john.get("METADATA");

     expect(mockSend).toHaveBeenCalledWith(
       expect.objectContaining({
         input: expect.objectContaining({
           Key: {
             PK: "TENANT#A#USER#john@example.com",
             SK: "METADATA"
           }
         })
       })
     );
  });
});
