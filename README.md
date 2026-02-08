# DynoQuery

A lightweight wrapper for Amazon DynamoDB using the AWS SDK v3, specifically designed for **Single-Table Design** patterns.

## Installation

```bash
npm install dynoquery
```

## Features

- Basic CRUD operations (create, get, update, delete)
- Optimized for **Single-Table Design**
- Model-based approach for easy data management
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
    User: { pkPrefix: 'USER#' },
  },
  indexes: {
    ByCategory: { indexName: 'GSI1', pkName: 'GSI1PK', skName: 'GSI1SK', pkPrefix: 'CAT#' }
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
  const profileModel = await john.create('PROFILE', { name: 'John Doe', email: 'john@example.com' });
  
  // Update the model (updates both DB and partition cache)
  await profileModel.update({ theme: 'dark' });

  // If you need the Model instance for save/delete without immediate create:
  const metaModel = john.model('METADATA');
  await metaModel.save({ lastLogin: new Date().toISOString() });

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
- `batchGet(params)`: Batch get items.
- `batchWrite(params)`: Batch write items.

### Model
A model-based abstraction for a specific data type.
- `find(id?)`: Find an item by ID (PK suffix).
- `save(data, id?)`: Save an item.
- `update(data, id?)`: Update an existing item (partial update).
- `remove(id?)`: Delete an item.

### Partition
A way to manage models and data within a specific partition.
- `get(sk)`: Fetches data for a specific sort key (returns a Promise).
- `getAll()`: Fetches all items in the partition and caches them. Returns the items.
- `create(sk, data)`: Creates an item in the partition and returns its `Model`.
- `model(sk)`: Get a `Model` instance for a specific sort key.
- `deleteAll()`: Deletes all items in the partition.

### IndexQuery
A way to query Global Secondary Indexes.
- `get(skValue | options)`: Query items in the index. Supports `skValue` (string) for `begins_with` search, or an options object with `skValue`, `limit`, and `scanIndexForward`.
- `getAll()`: Fetches all items in the index for the given partition key.
- Automatically identifies models in results using `__model` and provides `getPartition()` helper.

## License

MIT
