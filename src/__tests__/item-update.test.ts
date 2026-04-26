import { DynoQuery, Partition } from "../index";

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

describe("Item.update", () => {
  let db: DynoQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({ region: "us-east-1", tableName: "AppTable" });
  });

  it("should allow calling update() directly on a draft item", async () => {
    const john = new Partition(db, { pk: "USER#john@example.com" });
    const johnFriend: any = john.draft('FRIEND#1');

    mockSend.mockResolvedValueOnce({ Item: {} }); // asyncGet in partition.update
    mockSend.mockResolvedValueOnce({}); // db.create in partition.update

    await johnFriend.update({ Name: 'Alice', rank: 1 });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "USER#john@example.com",
            SK: "FRIEND#1",
            Name: 'Alice',
            rank: 1
          })
        })
      })
    );
  });

  it("should allow calling update() on an item returned by get()", async () => {
    const john = new Partition(db, { pk: "USER#john@example.com" });

    mockSend.mockResolvedValueOnce({ Item: { PK: "USER#john@example.com", SK: "PROFILE", name: "John" } });
    const profile: any = await john.get('PROFILE');

    mockSend.mockResolvedValueOnce({}); // db.create in partition.update (asyncGet will hit cache)

    await profile.update({ theme: 'dark' });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "USER#john@example.com",
            SK: "PROFILE",
            name: "John",
            theme: 'dark'
          })
        })
      })
    );
  });
});
