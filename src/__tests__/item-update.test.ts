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

  it("should allow calling update() on partition", async () => {
    const john = new Partition(db, { pk: "USER#john@example.com" });

    mockSend.mockResolvedValueOnce({ Item: {} }); // asyncGet in partition.update
    mockSend.mockResolvedValueOnce({}); // db.create in partition.update

    await john.update('FRIEND#1', { Name: 'Alice', rank: 1 });

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

});
