import { DynoQuery } from "../index";
import { Model } from "../model";

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

describe("Model", () => {
  let db: DynoQuery;
  let userModel: Model;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new DynoQuery({ region: "us-east-1" });
    userModel = new Model(db, {
      tableName: "UsersTable",
      pkPrefix: "USER#",
      skValue: "METADATA",
    });
  });

  describe("Configuration", () => {
    it("should use tableName from DynoQuery if not provided in ModelConfig", () => {
      const dbWithTable = new DynoQuery({ tableName: "DefaultTable" });
      const model = new Model(dbWithTable, {
        pkPrefix: "PREFIX#",
        skValue: "SK",
      });
      expect(model["tableName"]).toBe("DefaultTable");
    });

    it("should throw error if tableName is not provided anywhere", () => {
      const dbNoTable = new DynoQuery();
      expect(() => {
        new Model(dbNoTable, {
          pkPrefix: "PREFIX#",
          skValue: "SK",
        });
      }).toThrow("TableName must be provided in ModelConfig or DynoQueryConfig");
    });

    it("should prefer tableName from ModelConfig over DynoQueryConfig", () => {
      const dbWithTable = new DynoQuery({ tableName: "DefaultTable" });
      const model = new Model(dbWithTable, {
        tableName: "OverrideTable",
        pkPrefix: "PREFIX#",
        skValue: "SK",
      });
      expect(model["tableName"]).toBe("OverrideTable");
    });
  });

  describe("find", () => {
    it("should fetch an item with correct PK and SK", async () => {
      const mockItem = { PK: "USER#test@example.com", SK: "METADATA", name: "Test User" };
      mockSend.mockResolvedValueOnce({ Item: mockItem });

      const result = await userModel.find("test@example.com");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: "UsersTable",
            Key: {
              PK: "USER#test@example.com",
              SK: "METADATA",
            },
          },
        })
      );
      expect(result).toEqual(mockItem);
    });

    it("should return null if item is not found", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await userModel.find("nonexistent@example.com");

      expect(result).toBeNull();
    });
  });

  describe("save", () => {
    it("should save an item with correct PK and SK", async () => {
      const userData = { name: "New User", email: "new@example.com" };
      mockSend.mockResolvedValueOnce({});

      await userModel.save(userData, "new@example.com");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: "UsersTable",
            Item: {
              PK: "USER#new@example.com",
              SK: "METADATA",
              name: "New User",
              email: "new@example.com",
            },
          },
        })
      );
    });
  });

  describe("remove", () => {
    it("should delete an item with correct PK and SK", async () => {
      mockSend.mockResolvedValueOnce({});

      await userModel.remove("test@example.com");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: "UsersTable",
            Key: {
              PK: "USER#test@example.com",
              SK: "METADATA",
            },
          },
        })
      );
    });
  });
});
