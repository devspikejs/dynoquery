import { DynoQuery } from "../index";
import { Partition } from "../partition";
import { attr, ExpressionBuilder } from "../expression-builder";

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

describe("ExpressionBuilder", () => {
  let db: DynoQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({ region: "us-east-1", tableName: "AppTable" });
  });

  test("should build a simple equality condition", () => {
    const builder = attr("name").equals("John");
    const { expression, attributeNames, attributeValues } = builder.build();

    expect(expression).toBe("#n0 = :v0");
    expect(attributeNames).toEqual({ "#n0": "name" });
    expect(attributeValues).toEqual({ ":v0": "John" });
  });

  test("should build a BETWEEN condition", () => {
    const builder = attr("age").between(20, 30);
    const { expression, attributeNames, attributeValues } = builder.build();

    expect(expression).toBe("#n0 BETWEEN :v0 AND :v1");
    expect(attributeNames).toEqual({ "#n0": "age" });
    expect(attributeValues).toEqual({ ":v0": 20, ":v1": 30 });
  });

  test("should build an IN condition", () => {
    const builder = attr("status").in(["ACTIVE", "PENDING"]);
    const { expression, attributeNames, attributeValues } = builder.build();

    expect(expression).toBe("#n0 IN (:v0, :v1)");
    expect(attributeNames).toEqual({ "#n0": "status" });
    expect(attributeValues).toEqual({ ":v0": "ACTIVE", ":v1": "PENDING" });
  });

  test("should build attribute_exists function using fluent API", () => {
    const builder = attr("deletedAt").exists();
    const { expression, attributeNames } = builder.build();

    expect(expression).toBe("attribute_exists(#n0)");
    expect(attributeNames).toEqual({ "#n0": "deletedAt" });
  });

  test("should build attribute_not_exists function using fluent API", () => {
    const builder = attr("deletedAt").notExists();
    const { expression, attributeNames } = builder.build();

    expect(expression).toBe("attribute_not_exists(#n0)");
    expect(attributeNames).toEqual({ "#n0": "deletedAt" });
  });

  test("should build attribute_type function using fluent API", () => {
    const builder = attr("name").type("S");
    const { expression, attributeNames, attributeValues } = builder.build();

    expect(expression).toBe("attribute_type(#n0, :v0)");
    expect(attributeNames).toEqual({ "#n0": "name" });
    expect(attributeValues).toEqual({ ":v0": "S" });
  });

  test("should build begins_with function using fluent API", () => {
    const builder = attr("name").beginsWith("Jo");
    const { expression, attributeNames, attributeValues } = builder.build();

    expect(expression).toBe("begins_with(#n0, :v0)");
    expect(attributeNames).toEqual({ "#n0": "name" });
    expect(attributeValues).toEqual({ ":v0": "Jo" });
  });

  test("should build contains function using fluent API", () => {
    const builder = attr("tags").contains("Node");
    const { expression, attributeNames, attributeValues } = builder.build();

    expect(expression).toBe("contains(#n0, :v0)");
    expect(attributeNames).toEqual({ "#n0": "tags" });
    expect(attributeValues).toEqual({ ":v0": "Node" });
  });

  test("should build size function condition using fluent API", () => {
    const builder = attr("friends").size().greaterThan(5);
    const { expression, attributeNames, attributeValues } = builder.build();

    expect(expression).toBe("size(#n0) > :v0");
    expect(attributeNames).toEqual({ "#n0": "friends" });
    expect(attributeValues).toEqual({ ":v0": 5 });
  });

  test("should build attribute_exists function", () => {
    const builder = new ExpressionBuilder().attributeExists("deletedAt");
    const { expression, attributeNames } = builder.build();

    expect(expression).toBe("attribute_exists(#n0)");
    expect(attributeNames).toEqual({ "#n0": "deletedAt" });
  });

  test("should build begins_with function", () => {
    const builder = new ExpressionBuilder().beginsWith("name", "Jo");
    const { expression, attributeNames, attributeValues } = builder.build();

    expect(expression).toBe("begins_with(#n0, :v0)");
    expect(attributeNames).toEqual({ "#n0": "name" });
    expect(attributeValues).toEqual({ ":v0": "Jo" });
  });

  test("should build AND logical condition", () => {
    const cond1 = attr("age").greaterThan(18);
    const cond2 = attr("status").equals("ACTIVE");
    const combined = cond1.and(cond2);
    const { expression, attributeNames, attributeValues } = combined.build();

    expect(expression).toBe("(#n0 > :v0) AND (#n1 = :v1)");
    expect(attributeNames).toEqual({ "#n0": "age", "#n1": "status" });
    expect(attributeValues).toEqual({ ":v0": 18, ":v1": "ACTIVE" });
  });

  test("should build OR with grouping", () => {
    const cond1 = attr("age").greaterThan(18).and(attr("status").equals("ACTIVE"));
    const cond2 = attr("role").equals("ADMIN");
    const combined = cond1.or(cond2);
    const { expression } = combined.build();

    expect(expression).toBe("((#n0 > :v0) AND (#n1 = :v1)) OR (#n2 = :v2)");
  });

  test("should build NOT condition", () => {
    const cond = attr("status").equals("DISABLED");
    const negated = ExpressionBuilder.not(cond);
    const { expression } = negated.build();

    expect(expression).toBe("NOT (#n0 = :v0)");
  });

  test("should build size function condition", () => {
    const builder = new ExpressionBuilder().size("friends").greaterThan(5);
    const { expression, attributeNames, attributeValues } = builder.build();

    expect(expression).toBe("size(#n0) > :v0");
    expect(attributeNames).toEqual({ "#n0": "friends" });
    expect(attributeValues).toEqual({ ":v0": 5 });
  });

  test("should integrate with Partition.getAll and filterBuilder", async () => {
    const userPartition = new Partition(db, {
        pk: "USER#john@example.com",
    });

    const mockItems = [{ PK: "USER#john@example.com", SK: "META", age: 25, status: "ACTIVE" }];
    mockSend.mockResolvedValueOnce({ Items: mockItems });

    const builder = attr("age").greaterThan(20).and(attr("status").equals("ACTIVE"));
    const result = await userPartition.getAll({ filterBuilder: builder });

    expect(result).toHaveLength(1);
    expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
            input: expect.objectContaining({
                FilterExpression: "(#n0 > :v0) AND (#n1 = :v1)",
                ExpressionAttributeNames: expect.objectContaining({
                    "#n0": "age",
                    "#n1": "status",
                }),
                ExpressionAttributeValues: expect.objectContaining({
                    ":v0": 20,
                    ":v1": "ACTIVE",
                }),
            }),
        })
    );
  });

  test("should integrate with Item.save and conditionBuilder", async () => {
    const userPartition = new Partition(db, {
        pk: "USER#john@example.com",
    });

    mockSend.mockResolvedValueOnce({ Item: { PK: "USER#john@example.com", SK: "META", age: 25 } });
    const item = await userPartition.get("META") as any;

    mockSend.mockResolvedValueOnce({}); // For save/create

    const condition = attr("age").equals(25);
    item.setCondition(condition);
    item.age = 26;
    await item.save();

    expect(mockSend).toHaveBeenLastCalledWith(
        expect.objectContaining({
            input: expect.objectContaining({
                ConditionExpression: "#n0 = :v0",
                ExpressionAttributeNames: expect.objectContaining({ "#n0": "age" }),
                ExpressionAttributeValues: expect.objectContaining({ ":v0": 25 }),
            }),
        })
    );
  });
});
