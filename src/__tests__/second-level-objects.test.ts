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

describe("Second Level Objects (RowProxy)", () => {
  let db: DynoQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      region: "us-east-1",
      tableName: "AppTable",
      models: {
        User: { pkPrefix: "USER#" }
      }
    });
  });

  it("should create a new item using draft() and save()", async () => {
    mockSend.mockResolvedValue({});
    const john = (db as any).User('john@example.com');
    const johnMeta = john.draft('METADATA');
    johnMeta.name = 'John Doe';
    johnMeta.email = 'johndoe@johnmail.com';

    await johnMeta.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: 'USER#john@example.com',
            SK: 'METADATA',
            name: 'John Doe',
            email: 'johndoe@johnmail.com'
          })
        })
      })
    );
  });

  it("should update an item using get() and save()", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: { PK: 'USER#john@example.com', SK: 'BIO', birthYear: 1980 } })
      .mockResolvedValueOnce({});

    const john = (db as any).User('john@example.com');
    const johnBio = await john.get('BIO');

    johnBio.birthYear = 1986;
    await johnBio.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: 'USER#john@example.com',
            SK: 'BIO',
            birthYear: 1986
          })
        })
      })
    );
  });

  it("should work with save() for both create and update", async () => {
    mockSend.mockResolvedValue({});

    const john = (db as any).User('john@example.com');

    // Save for new item (draft)
    const johnStat = john.draft('STAT');
    johnStat.views = 100;
    await johnStat.save();

    expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Item: expect.objectContaining({
              PK: 'USER#john@example.com',
              SK: 'STAT',
              views: 100
            })
          })
        })
      );

    // Save for existing item (get)
    mockSend.mockResolvedValueOnce({ Item: { PK: 'USER#john@example.com', SK: 'FRIEND#1', rank: 2 } })
            .mockResolvedValueOnce({});

    const johnFriend1 = await john.get('FRIEND#1');
    johnFriend1.rank = 1;
    await johnFriend1.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: 'USER#john@example.com',
            SK: 'FRIEND#1',
            rank: 1
          })
        })
      })
    );
  });
});
