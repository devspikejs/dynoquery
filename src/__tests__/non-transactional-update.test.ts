import { DynoQuery, attr } from "../index";

// Mock DynamoDBDocumentClient
const mockSend = jest.fn();
jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: () => ({
        send: (...args: any[]) => mockSend(...args),
      }),
    },
  };
});

describe("Non-transactional Update Operations", () => {
  let db: DynoQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({
      tableName: "TestTable",
      models: {
        User: { pkPrefix: "USER#" },
      },
    });
  });

  it("should support updateAction with .save() for non-transactional updates", async () => {
    const user = db.User("john").draft("METADATA");
    (user as any).updateAction({
      UpdateExpression: "SET #name = :name",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: { ":name": "John Updated" },
    });

    mockSend.mockResolvedValue({});

    await user.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "TestTable",
          Key: {
            PK: "USER#john",
            SK: "METADATA",
          },
          UpdateExpression: "SET #name = :name",
          ExpressionAttributeNames: { "#name": "name" },
          ExpressionAttributeValues: { ":name": "John Updated" },
        }),
      })
    );
  });

  it("should support updateAction with .save() and condition", async () => {
    const user = db.User("john").draft("METADATA");
    (user as any).updateAction({
      UpdateExpression: "SET #name = :name",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: { ":name": "John Updated" },
    });
    user.setCondition(attr("version").equals(1));

    mockSend.mockResolvedValue({});

    await user.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "TestTable",
          Key: {
            PK: "USER#john",
            SK: "METADATA",
          },
          UpdateExpression: "SET #name = :name",
          ConditionExpression: "#n0 = :v0",
          ExpressionAttributeNames: { "#name": "name", "#n0": "version" },
          ExpressionAttributeValues: { ":name": "John Updated", ":v0": 1 },
        }),
      })
    );
  });
});
