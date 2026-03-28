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
  models: {
    User: { pkPrefix: 'USER#' }, // TENANT#A#USER#
  },
  findBy: {
    //  TENANT#A#CAT#
    Category: { indexName: 'GSI1', pkPrefix: 'CAT#' }, // pkName defaults to GSI1PK, skName defaults to GSI1SK
    Date: { indexName: 'GSI2', pkPrefix: 'DATE#' }
  }
});

async function example() {
  // Use registered partition
  // Resulting PK: TENANT#A#USER#john@example.com
  const john = db.User('john@example.com');
  
  // Use registered index
  // Resulting GSI1PK: TENANT#A#CAT#1
  const categories = db.findByCategory('1');
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
  
  // Resulting GSI1PK: TENANT#A#CAT#USER
  const cat = db.findByCategory('USER', '1');
  const date = db.findByDate('2026-10-11', '2');
  console.log(cat.getSkValue()); // '1'
  await john.create('PROFILE', { 
    name: 'John Doe', 
    email: 'john@example.com', 
  }, [cat, date]);

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

## API Reference

### DynoQuery
The main client for interacting with DynamoDB.
- `create(params)`: Put an item.
- `get(params)`: Get an item.
- `update(params)`: Update an item.
- `delete(params)`: Delete an item.
- `query(params)`: Query items.
- `scan(params)`: Scan items.

### Partition
A way to manage data within a specific partition.
- `getPkValue()`: Returns the generated partition key value.
- `get(sk)`: Fetches data for a specific sort key (returns a Promise).
- `getAll()`: Fetches all items in the partition and caches them. Returns the items.
- `create(sk, data, indices?)`: Creates an item in the partition. If `indices` (array of `IndexQuery`) are provided, it automatically adds the index PK and SK to the item.
- `update(sk, data)`: Updates an existing item (partial update).
- `delete(sk)`: Deletes an item.
- `deleteAll()`: Deletes all items in the partition.

### IndexQuery
A way to query Global Secondary Indexes.
- `getPkValue()`: Returns the generated partition key value for this index.
- `getSkValue()`: Returns the sort key value if it was provided when calling the index query method.
- `get(skValue | options)`: Query items in the index. Supports `skValue` (string) for `begins_with` search, or an options object with `skValue`, `limit`, and `scanIndexForward`. If `skValue` was provided when the `IndexQuery` was created, it will be used as the default if no `skValue` is passed here.
- `getAll()`: Fetches all items in the index for the given partition key. If `skValue` was provided when the `IndexQuery` was created, it will filter by it using `begins_with`.
- Automatically identifies the model name in results using `__model` (based on registered models) and provides `getPartition()` helper.

## License

MIT
