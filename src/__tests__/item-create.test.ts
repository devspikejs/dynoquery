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

describe("Item.create", () => {
  let db: DynoQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({ region: "us-east-1", tableName: "AppTable" });
  });

  it("should allow creating an item using partition.create(sk, data)", async () => {
    const john = new Partition(db, { pk: "USER#john@example.com" });

    mockSend.mockResolvedValue({});
    await john.create('METADATA', { name: 'John Doe', email: 'johndoe@johnmail.com' });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "USER#john@example.com",
            SK: "METADATA",
            name: 'John Doe',
            email: 'johndoe@johnmail.com'
          })
        })
      })
    );
  });


  it("should include properties set on the item when using item.save()", async () => {
    const john = new Partition(db, { pk: "USER#john@example.com" });
    const johnMeta: any = john.draft('METADATA');
    johnMeta.name = 'John Doe';

    mockSend.mockResolvedValue({});
    await johnMeta.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "USER#john@example.com",
            SK: "METADATA",
            name: 'John Doe'
          })
        })
      })
    );
  });

  it("should allow creating an item with indices using partition.create(sk, data, indices)", async () => {
    const dbWithGSIs = new DynoQuery({
      region: 'us-east-1',
      tableName: 'AppTable',
      findBy: {
        Category: { indexName: 'GSI1', pkPrefix: 'CAT#' },
      }
    });

    const john = new Partition(dbWithGSIs, { pk: "USER#john@example.com" });

    const electronics = (dbWithGSIs as any).findByCategory('ELECTRONICS', 'RANK#1');

    mockSend.mockResolvedValue({});
    await john.create('METADATA', { name: 'John Doe' }, [electronics]);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: "USER#john@example.com",
            SK: "METADATA",
            name: 'John Doe',
            GSI1PK: 'CAT#ELECTRONICS',
            GSI1SK: 'RANK#1'
          })
        })
      })
    );
  });
});
