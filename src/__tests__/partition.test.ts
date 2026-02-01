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
    expect(data).toEqual({ name: "John", SK: "PROFILE" });
  });

  it("should loadAll all partition data using loadAll() and then return from cache", async () => {
    const mockItems = [
      { PK: "USER#john@example.com", SK: "METADATA", email: "john@example.com" },
      { PK: "USER#john@example.com", SK: "PROFILE", name: "John" },
    ];
    mockSend.mockResolvedValueOnce({ Items: mockItems });

    await userPartition.loadAll();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: {
            ":pk": "USER#john@example.com",
          },
        }),
      })
    );

    // This should NOT trigger another network call
    const metadata = await userPartition.get("METADATA");
    const profile = await userPartition.get("PROFILE");

    expect(metadata).toEqual(mockItems[0]);
    expect(profile).toEqual(mockItems[1]);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should allow saving data to the partition model via model()", async () => {
    const profileModel = userPartition.model("PROFILE");
    mockSend.mockResolvedValue({ });

    await profileModel.save({ name: "John Doe", age: 30 });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TableName: "AppTable",
          Item: {
            PK: "USER#john@example.com",
            SK: "PROFILE",
            name: "John Doe",
            age: 30,
          },
        },
      })
    );
  });

  it("should allow creating an item directly from partition and update cache", async () => {
    mockSend.mockResolvedValue({ }); // default response for all calls

    const profile = await userPartition.create("PROFILE", { name: "John Doe" });

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
    expect(cachedData).toEqual({
      PK: "USER#john@example.com",
      SK: "PROFILE",
      name: "John Doe",
    });
    // Should NOT have called mockSend again because it's in cache
    // We called it 1 time for create
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should update cache when model.update is called", async () => {
    const profileModel = userPartition.model("PROFILE");

    // update calls db.get then db.create (via save)
    mockSend
      .mockResolvedValue({ }) // default
      .mockResolvedValueOnce({ Item: { PK: "USER#john@example.com", SK: "PROFILE", name: "John" } }) // get
      .mockResolvedValueOnce({ }); // create (save)

    await profileModel.update({ theme: "dark" });

    const cachedData = await userPartition.get("PROFILE");
    expect(cachedData).toEqual({
      PK: "USER#john@example.com",
      SK: "PROFILE",
      name: "John",
      theme: "dark",
    });
  });

  it("should remove from cache when model.remove is called", async () => {
    const profileModel = userPartition.model("PROFILE");

    // Pre-populate cache
    mockSend.mockResolvedValueOnce({ Item: { PK: "USER#john@example.com", SK: "PROFILE", name: "John" } });
    await userPartition.get("PROFILE");
    expect(userPartition["cache"]["PROFILE"]).toBeDefined();

    mockSend.mockResolvedValueOnce({}); // remove
    await profileModel.remove();

    expect(userPartition["cache"]["PROFILE"]).toBeUndefined();
  });

  it("should delete all items in the partition using deleteAll()", async () => {
    const mockItems = [
      { PK: "USER#john@example.com", SK: "METADATA" },
      { PK: "USER#john@example.com", SK: "PROFILE" },
    ];

    // 1. Query call to find items
    // 2. batchWrite call to delete items
    mockSend
      .mockResolvedValueOnce({ Items: mockItems }) // query
      .mockResolvedValueOnce({}); // batchWrite

    // Pre-populate cache to verify it's cleared
    userPartition["cache"]["METADATA"] = mockItems[0];
    userPartition["isLoaded"] = true;

    await userPartition.deleteAll();

    // Verify query was called
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "PK = :pk",
        }),
      })
    );

    // Verify batchWrite was called
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          RequestItems: expect.objectContaining({
            "AppTable": expect.arrayContaining([
              expect.objectContaining({
                DeleteRequest: expect.objectContaining({
                  Key: { PK: "USER#john@example.com", SK: "METADATA" }
                })
              })
            ])
          })
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
