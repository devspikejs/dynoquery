import { DynoQuery } from "../index";
import { Partition } from "../partition";
import { IndexQuery } from "../index-query";

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

describe("Filters in getAll()", () => {
  let db: DynoQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({ region: "us-east-1", tableName: "AppTable" });
  });

  describe("Partition.getAll()", () => {
    it("should allow passing filters to Partition.getAll()", async () => {
      const userPartition = new Partition(db, {
        pk: "USER#john@example.com",
      });

      const mockItems = [
        { PK: "USER#john@example.com", SK: "ITEM#1", status: "active" },
      ];
      mockSend.mockResolvedValueOnce({ Items: mockItems });

      const result = await userPartition.getAll({
        filterExpression: "#status = :status",
        expressionAttributeNames: { "#status": "status" },
        expressionAttributeValues: { ":status": "active" },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject(mockItems[0]);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            FilterExpression: "#status = :status",
            ExpressionAttributeNames: {
              "#pk": "PK",
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":pk": "USER#john@example.com",
              ":status": "active",
            },
          }),
        })
      );
    });
  });

  describe("IndexQuery.getAll()", () => {
    it("should allow passing filters to IndexQuery.getAll()", async () => {
      const indexQuery = new IndexQuery(db, {
        indexName: "GSI1",
        pkValue: "ORG#1",
      });

      const mockItems = [
        { GSI1PK: "ORG#1", GSI1SK: "USER#1", role: "admin" },
      ];
      mockSend.mockResolvedValueOnce({ Items: mockItems });

      const result = await indexQuery.getAll({
        filterExpression: "#role = :role",
        expressionAttributeNames: { "#role": "role" },
        expressionAttributeValues: { ":role": "admin" },
      });

      expect(result).toEqual(mockItems);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            FilterExpression: "#role = :role",
            ExpressionAttributeNames: {
              "#pk": "GSI1PK",
              "#role": "role",
            },
            ExpressionAttributeValues: {
              ":pk": "ORG#1",
              ":role": "admin",
            },
          }),
        })
      );
    });

    it("should combine filters with SK condition in IndexQuery.getAll()", async () => {
      const indexQuery = new IndexQuery(db, {
        indexName: "GSI1",
        pkValue: "ORG#1",
        skValue: "USER#",
      });

      const mockItems = [
        { GSI1PK: "ORG#1", GSI1SK: "USER#1", role: "admin" },
      ];
      mockSend.mockResolvedValueOnce({ Items: mockItems });

      const result = await indexQuery.getAll({
        filterExpression: "#role = :role",
        expressionAttributeNames: { "#role": "role" },
        expressionAttributeValues: { ":role": "admin" },
      });

      expect(result).toEqual(mockItems);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
            FilterExpression: "#role = :role",
            ExpressionAttributeNames: {
              "#pk": "GSI1PK",
              "#sk": "GSI1SK",
              "#role": "role",
            },
            ExpressionAttributeValues: {
              ":pk": "ORG#1",
              ":sk": "USER#",
              ":role": "admin",
            },
          }),
        })
      );
    });
  });
});
