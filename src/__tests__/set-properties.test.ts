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

describe("Partition.draft properties", () => {
  let db: DynoQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({ region: "us-east-1", tableName: "AppTable" });
  });

  it("should allow passing properties to draft()", async () => {
    const john = new Partition(db, { pk: "USER#john@example.com" });
    const johnStat: any = john.draft('STAT', { "views": 100 });

    expect(johnStat.views).toBe(100);

    mockSend.mockResolvedValue({});
    await johnStat.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "USER#john@example.com",
            SK: "STAT",
            views: 100
          })
        })
      })
    );
  });

  it("should allow passing properties to draft() via item", async () => {
    const dbWithModels = new DynoQuery({
      region: "us-east-1",
      tableName: "AppTable",
      models: {
        User: { pkPrefix: "USER#" }
      }
    });
    const john = (dbWithModels as any).User('john@example.com');
    const johnStat: any = john.draft('STAT', { "views": 100 });

    expect(johnStat.views).toBe(100);

    mockSend.mockResolvedValue({});
    await johnStat.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "USER#john@example.com",
            SK: "STAT",
            views: 100
          })
        })
      })
    );
  });
});
