# DynoQuery

A lightweight wrapper for Amazon DynamoDB using the AWS SDK v3, specifically designed for **Single-Table Design** patterns.

## Installation

```bash
npm install dynoquery
```

## Features

- Basic CRUD operations (create, get, update, delete)
- Optimized for **Single-Table Design**
- Query and Scan support
- Batch operations (batchGet, batchWrite)
- TypeScript support

## Usage

```typescript
import { DynoQuery } from 'dynoquery';

const db = new DynoQuery({
  region: 'us-east-1',
  tableName: 'MyTable', // Define default table for single-table structure
  pkName: 'PK', // Optional: Custom attribute name for Partition Key (default: 'PK')
  skName: 'SK', // Optional: Custom attribute name for Sort Key (default: 'SK')
  pkPrefix: 'TENANT#A#', // Optional: Global prefix for all partitions (useful for multitenancy)
  // optional endpoint for local development
  // endpoint: 'http://localhost:8000'
  partitions: {
    User: { pkPrefix: 'USER#' }, // TENANT#A#USER#
  },
  indexes: {
    //  TENANT#A#CAT#
    ByCategory: { indexName: 'GSI1', pkPrefix: 'CAT#' } // pkName defaults to GSI1PK, skName defaults to GSI1SK
  }
});

async function example() {
  // Use registered partition
  // Resulting PK: TENANT#A#USER#john@example.com
  const john = db.User('john@example.com');
  
  // Use registered index
  // Resulting GSI1PK: TENANT#A#CAT#1
  const categories = db.ByCategory('1');
  const items = await categories.get('100');
  const allItems = await categories.getAll();
  
  // Index results are automatically mapped to models based on PK prefix
  items.forEach(item => {
    if (item.__model === 'User') {
      console.log('Found user:', item.name);
      // You can also get a Partition instance for this item
      const userPartition = item.getPartition();
    }
  });
  
  // Load all data for this partition (optional, but good for multiple reads)
  const allJohnData = await john.getAll();
  
  // john.get() loads data immediately (using cache if loaded)
  const userMetadata = await john.get('METADATA');
  console.log(userMetadata);

  // Create an item through partition
  await john.create('PROFILE', { name: 'John Doe', email: 'john@example.com' });
  
  // You can also use getPkValue() to get the generated PK for the partition or index
  // This is useful when you need to store it in another attribute (e.g., GSI)
  const cat = db.ByCategory('USER');
  await john.create('PROFILE', { 
    name: 'John Doe', 
    email: 'john@example.com', 
    GSI1PK: cat.getPkValue(), 
    GSI1SK: 'john@example.com' 
  });

  // Update the item (updates both DB and partition cache)
  await john.update('PROFILE', { theme: 'dark' });

  // Delete an item
  await john.delete('METADATA');

  // Advanced Partition usage (Subclassing)
  class UserPartition extends Partition {
    constructor(db: DynoQuery, email: string) {
      super(db, { pkPrefix: 'USER#' }, email);
    }
  }

  const user2 = new UserPartition(db, 'jane@example.com');
  const data2 = await user2.get('METADATA');
  console.log(data2);
}
```

### Batch Operations

If you have a `tableName` configured in `DynoQuery`, you can use the `Items` property in `batchGet` and `batchWrite` to automatically target that table.

You can also generate items for `batchGet` using the `batchGetInput` method from partitions and indexes:

```typescript
const john = db.User('john@example.com');
const jack = db.User('jack@example.com');
const cat = db.ByCategory('1');

const batchItem1 = john.batchGetInput('METADATA');
const batchOthers = cat.batchGetInput('METADATA', 'DATA', 'PROFILE');
const batchCat = cat.batchGetInput(); // No sk defined, so will get partition key only

await db.batchGet(batchItem1, batchOthers, batchCat);
```

```typescript
// batchGet with explicit Items
await db.batchGet({
  Items: [
    { PK: 'USER#1', SK: 'METADATA' },
    { PK: 'USER#2', SK: 'METADATA' }
  ]
});

// batchWrite with simplified Items (automatically wrapped in PutRequest)
await db.batchWrite({
  Items: [
    { PK: 'USER#3', SK: 'METADATA', name: 'Alice' },
    {
      DeleteRequest: {
        Key: { PK: 'USER#1', SK: 'SESSION#123' }
      }
    }
  ]
});
```

You can still use the standard AWS SDK `RequestItems` if you need to target multiple tables or if you prefer the original syntax.

## API Reference

### DynoQuery
The main client for interacting with DynamoDB.
- `create(params)`: Put an item.
- `get(params)`: Get an item.
- `update(params)`: Update an item.
- `delete(params)`: Delete an item.
- `query(params)`: Query items.
- `scan(params)`: Scan items.
- `batchGet(params)`: Batch get items.
- `batchWrite(params)`: Batch write items.

### Partition
A way to manage data within a specific partition.
- `getPkValue()`: Returns the generated partition key value.
- `get(sk)`: Fetches data for a specific sort key (returns a Promise).
- `getAll()`: Fetches all items in the partition and caches them. Returns the items.
- `create(sk, data)`: Creates an item in the partition.
- `update(sk, data)`: Updates an existing item (partial update).
- `delete(sk)`: Deletes an item.
- `batchGetInput(...sks)`: Generates items for batch query.
- `batchWriteInput(...items)`: Generates items for batch write.
- `batchDeleteInput(...sks)`: Generates items for batch delete.
- `deleteAll()`: Deletes all items in the partition.

### IndexQuery
A way to query Global Secondary Indexes.
- `getPkValue()`: Returns the generated partition key value for this index.
- `get(skValue | options)`: Query items in the index. Supports `skValue` (string) for `begins_with` search, or an options object with `skValue`, `limit`, and `scanIndexForward`.
- `getAll()`: Fetches all items in the index for the given partition key.
- `batchGetInput(...sks)`: Generates items for batch query.
- `batchWriteInput(...items)`: Generates items for batch write.
- `batchDeleteInput(...sks)`: Generates items for batch delete.
- Automatically identifies models in results using `__model` and provides `getPartition()` helper.

## License

MIT
