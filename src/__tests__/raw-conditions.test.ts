import { DynoQuery } from "../index";
import { attr } from "../index";

describe("Raw Condition Expressions", () => {
  let db: DynoQuery;
  let mockSend: jest.Mock;

  beforeEach(() => {
    mockSend = jest.fn();
    db = new DynoQuery({
      tableName: "TestTable",
      region: "us-east-1",
      models: {
        User: { pkPrefix: "USER#" },
      },
    });
    (db as any).docClient = { send: mockSend };
  });

  it("should support raw conditionExpression in Partition.create()", async () => {
    mockSend.mockResolvedValueOnce({});

    const user = db.User("john");
    await user.create("INFO", { name: "John" }, [], {
      conditionExpression: "attribute_not_exists(#pk)",
      expressionAttributeNames: { "#pk": "PK" },
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ConditionExpression: "attribute_not_exists(#pk)",
          ExpressionAttributeNames: expect.objectContaining({
            "#pk": "PK",
          }),
        }),
      })
    );
  });

  it("should support raw conditionExpression in Partition.update()", async () => {
    mockSend.mockResolvedValueOnce({ Item: { name: "John" } }); // For _getRaw
    mockSend.mockResolvedValueOnce({}); // For create (internal call of update)

    const user = db.User("john");
    await user.update("INFO", { name: "John Doe" }, [], {
      conditionExpression: "#name = :oldName",
      expressionAttributeNames: { "#name": "name" },
      expressionAttributeValues: { ":oldName": "John" },
    });

    expect(mockSend).toHaveBeenLastCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ConditionExpression: "#name = :oldName",
          ExpressionAttributeNames: expect.objectContaining({
            "#name": "name",
          }),
          ExpressionAttributeValues: expect.objectContaining({
            ":oldName": "John",
          }),
        }),
      })
    );
  });

  it("should support fluent condition in Item methods via setCondition(builder)", async () => {
    mockSend.mockResolvedValue({});

    const item: any = db.User("john", "INFO");
    item.name = "John Doe";
    item.setCondition(attr("name").exists());
    await item.save();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ConditionExpression: "attribute_exists(#n0)",
          ExpressionAttributeNames: expect.objectContaining({
            "#n0": "name",
          }),
        }),
      })
    );
  });

  it("should support raw conditionExpression in Partition.delete()", async () => {
    mockSend.mockResolvedValueOnce({});

    const user = db.User("john");
    await user.delete("INFO", {
      conditionExpression: "attribute_exists(#sk)",
      expressionAttributeNames: { "#sk": "SK" },
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ConditionExpression: "attribute_exists(#sk)",
          ExpressionAttributeNames: expect.objectContaining({
            "#sk": "SK",
          }),
        }),
      })
    );
  });
});
