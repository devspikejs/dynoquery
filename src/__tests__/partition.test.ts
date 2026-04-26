import { DynoQuery } from "../index";
import { Partition } from "../partition";

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

describe("Partition", () => {
  let db: DynoQuery;
  let userPartition: Partition;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({ region: "us-east-1", tableName: "AppTable" });
    userPartition = new Partition(db, {
      pk: "USER#john@example.com",
    });
  });

  it("should fetch data immediately using get()", async () => {
    mockSend.mockResolvedValueOnce({ Item: { name: "John", SK: "PROFILE" } });

    const data = await userPartition.get("PROFILE");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Key: {
            PK: "USER#john@example.com",
            SK: "PROFILE",
          },
        }),
      })
    );
    expect(data).toMatchObject({ name: "John", SK: "PROFILE" });
  });

  it("should getAll all partition data using getAll() and then return from cache", async () => {
    const mockItems = [
      { PK: "USER#john@example.com", SK: "METADATA", email: "john@example.com" },
      { PK: "USER#john@example.com", SK: "PROFILE", name: "John" },
    ];
    mockSend.mockResolvedValueOnce({ Items: mockItems });

    const result = await userPartition.getAll();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject(mockItems[0]);
    expect(result[1]).toMatchObject(mockItems[1]);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "#pk = :pk",
          ExpressionAttributeNames: {
            "#pk": "PK",
          },
          ExpressionAttributeValues: {
            ":pk": "USER#john@example.com",
          },
        }),
      })
    );

    // This should NOT trigger another network call
    const metadata = await userPartition.get("METADATA");
    const profile = await userPartition.get("PROFILE");

    expect(metadata).toMatchObject(mockItems[0]);
    expect(profile).toMatchObject(mockItems[1]);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should allow creating an item directly from partition and update cache", async () => {
    mockSend.mockResolvedValue({}); // default response for all calls

    const createdItem = await userPartition.create("PROFILE", { name: "John Doe" });

    expect(createdItem).toMatchObject({
      PK: "USER#john@example.com",
      SK: "PROFILE",
      name: "John Doe",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "USER#john@example.com",
            SK: "PROFILE",
            name: "John Doe",
          }),
        }),
      })
    );

    // Verify cache update
    const cachedData = await userPartition.get("PROFILE");
    expect(cachedData).toMatchObject({
      PK: "USER#john@example.com",
      SK: "PROFILE",
      name: "John Doe",
    });
    // Should NOT have called mockSend again because it's in cache
    // We called it 1 time for create
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should update cache when update is called", async () => {
    // update calls db.get then db.create
    mockSend
      .mockResolvedValueOnce({ Item: { PK: "USER#john@example.com", SK: "PROFILE", name: "John" } }) // get
      .mockResolvedValueOnce({}); // create

    const updatedItem = await userPartition.update("PROFILE", { theme: "dark" });

    expect(updatedItem).toMatchObject({
      PK: "USER#john@example.com",
      SK: "PROFILE",
      name: "John",
      theme: "dark",
    });

    const cachedData = await userPartition.get("PROFILE");
    expect(cachedData).toMatchObject({
      PK: "USER#john@example.com",
      SK: "PROFILE",
      name: "John",
      theme: "dark",
    });
  });

  it("should remove from cache when delete is called", async () => {
    // Pre-populate cache
    mockSend.mockResolvedValueOnce({ Item: { PK: "USER#john@example.com", SK: "PROFILE", name: "John" } });
    await userPartition.get("PROFILE");
    expect(userPartition["cache"]["PROFILE"]).toBeDefined();

    mockSend.mockResolvedValueOnce({}); // delete
    await userPartition.delete("PROFILE");

    expect(userPartition["cache"]["PROFILE"]).toBeUndefined();
  });

  it("should delete all items in the partition using deleteAll()", async () => {
    const mockItems = [
      { PK: "USER#john@example.com", SK: "METADATA" },
      { PK: "USER#john@example.com", SK: "PROFILE" },
    ];

    // 1. Query call to find items
    // 2. delete call for METADATA
    // 3. delete call for PROFILE
    mockSend
      .mockResolvedValueOnce({ Items: mockItems }) // query
      .mockResolvedValueOnce({}) // delete 1
      .mockResolvedValueOnce({}); // delete 2

    // Pre-populate cache to verify it's cleared
    userPartition["cache"]["METADATA"] = mockItems[0];
    userPartition["isLoaded"] = true;

    await userPartition.deleteAll();

    // Verify query was called
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "#pk = :pk",
          ExpressionAttributeNames: {
            "#pk": "PK",
          },
        }),
      })
    );

    // Verify delete was called for each item
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "AppTable",
          Key: { PK: "USER#john@example.com", SK: "METADATA" }
        }),
      })
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "AppTable",
          Key: { PK: "USER#john@example.com", SK: "PROFILE" }
        }),
      })
    );

    // Verify cache and isLoaded are reset
    expect(userPartition["cache"]).toEqual({});
    expect(userPartition["isLoaded"]).toBe(false);
  });

  it("should throw error if tableName is not provided", () => {
    const dbNoTable = new DynoQuery();
    expect(() => {
      new Partition(dbNoTable, { pk: "PARTITION#1" });
    }).toThrow("TableName must be provided in PartitionConfig or DynoQueryConfig");
  });

  describe("Subclassing", () => {
    class UserPartition extends Partition {
      constructor(db: DynoQuery, id: string) {
        super(db, { pkPrefix: "USER#" }, id);
      }
    }

    it("should work correctly when subclassed", async () => {
      const john = new UserPartition(db, "john@example.com");

      mockSend.mockResolvedValueOnce({ Item: { email: "john@example.com", name: "John" } });
      const data = await john.get("METADATA");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: {
              PK: "USER#john@example.com",
              SK: "METADATA",
            },
          }),
        })
      );
      expect(data.name).toBe("John");
    });
  });
});
