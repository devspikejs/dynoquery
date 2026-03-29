# DynoQuery

A lightweight wrapper for Amazon DynamoDB using the AWS SDK v3, specifically designed for **Single-Table Design** patterns.

## Installation

```bash
npm install dynoquery
```

## Features

- Basic CRUD operations (create, get, update, delete)
- Optimized for **Single-Table Design** (Partitions and GSIs)
- Automatic result mapping to models
- Built-in caching for partition instances
- TypeScript support

## Quick Start (Basic Usage)

First, initialize the client with your table name.

```typescript
import { DynoQuery } from 'dynoquery';

const db = new DynoQuery({
  region: 'us-east-1',
  tableName: 'MyTable'
});
```

### 1. Working with Partitions (Models)

Define your models to handle different types of data within your single table.

```typescript
const db = new DynoQuery({
  region: 'us-east-1',
  tableName: 'MyTable',
  models: {
    User: { pkPrefix: 'USER#' }, // Resulting PK: USER#<id>
    Product: { pkPrefix: 'PROD#' }
  }
});

async function userExample() {
  const john = db.User('john@example.com');
  
  // Create an item (SK: PROFILE)
  await john.create('PROFILE', { name: 'John Doe', email: 'john@example.com' });
  
  // Get an item (uses cache if already loaded)
  const profile = await john.get('PROFILE');
  console.log(profile.name); // 'John Doe'

  // Update an item (partial update)
  await john.update('PROFILE', { theme: 'dark' });

  // Delete an item
  await john.delete('PROFILE');
  
  // Fetch all items in this partition
  const allData = await john.getAll();
}
```

### 2. Global Secondary Indexes (findBy)

Use `findBy` to query your GSIs easily.

```typescript
const db = new DynoQuery({
  region: 'us-east-1',
  tableName: 'MyTable',
  models: {
    Product: { pkPrefix: 'PROD#' }
  },
  findBy: {
    Category: { indexName: 'GSI1', pkPrefix: 'CAT#' }, // pkName defaults to GSI1PK, skName defaults to GSI1SK
  }
});

async function indexExample() {
  // Query by Category PK: CAT#ELECTRONICS
  const electronics = db.findByCategory('ELECTRONICS');
  
  // Get all items in this category
  const items = await electronics.getAll();
  
  // If results match a registered model prefix, they are automatically mapped
  items.forEach(item => {
    if (item.__model === 'Product') {
      const productPartition = item.getPartition(); // Returns a Partition instance
    }
  });
}
```

### 3. Creating Items with GSI Support

You can pass index queries directly to `create()` to automatically populate GSI attributes.

```typescript
const electronics = db.findByCategory('ELECTRONICS', 'RANK#1');

// This will automatically set GSI1PK='CAT#ELECTRONICS' and GSI1SK='RANK#1'
await db.Product('p123').create('INFO', { 
  name: 'Gaming Mouse',
  price: 50
}, [electronics]);
```

## Optional Configuration Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `pkName` | `string` | `'PK'` | Custom attribute name for Partition Key. |
| `skName` | `string` | `'SK'` | Custom attribute name for Sort Key. |
| `pkPrefix` | `string` | `''` | Global prefix for all partitions (useful for multitenancy, e.g., `TENANT#A#`). |
| `endpoint` | `string` | - | Optional endpoint for local development (e.g., `http://localhost:8000`). |
| `credentials` | `object` | - | Custom AWS credentials (`{ accessKeyId, secretAccessKey, sessionToken? }`). |

### Example with Optional Parameters

```typescript
const db = new DynoQuery({
  region: 'us-east-1',
  tableName: 'MyTable',
  pkName: 'PartitionKey', // Custom PK name
  skName: 'SortKey',      // Custom SK name
  pkPrefix: 'TENANT#A#',   // Global prefix for multitenancy
  endpoint: 'http://localhost:8000', // For local DynamoDB
  credentials: {
    accessKeyId: 'MY_ACCESS_KEY',
    secretAccessKey: 'MY_SECRET_KEY'
  }
});
```

## Advanced Usage

### Pagination

Both `Partition.getAll()` and `IndexQuery.getAll()` support pagination.

```typescript
const index = db.findByCategory('ELECTRONICS');
const items = await index.getAll({ limit: 10 });

const token = index.getLastEvaluatedKey();
if (token) {
  // Fetch next page
  const nextItems = await index.getAll({ limit: 10, exclusiveStartKey: token });
}
```

## API Reference

### DynoQuery
- `create(params)`: Low-level PutCommand wrapper.
- `get(params)`: Low-level GetCommand wrapper.
- `update(params)`: Low-level UpdateCommand wrapper.
- `delete(params)`: Low-level DeleteCommand wrapper.
- `query(params)`: Low-level QueryCommand wrapper.
- `scan(params)`: Low-level ScanCommand wrapper.

### Partition
- `get(sk)`: Fetches data for a specific SK (returns a Promise).
- `getAll(options?)`: Fetches items in the partition. Options: `{ limit, exclusiveStartKey }`.
- `create(sk, data, indices?)`: Creates an item. `indices` is an array of `IndexQuery` for GSI population.
- `update(sk, data)`: Partial update of an item.
- `delete(sk)`: Deletes an item.
- `deleteAll()`: Deletes all items in the partition.
- `getLastEvaluatedKey()`: Returns the pagination token from the last `getAll()`.

### IndexQuery
- `get(skValue?)`: Get a single item from the index.
- `getAll(options?)`: Query index. Options: `{ limit, scanIndexForward, exclusiveStartKey, skValue }`.
- `getLastEvaluatedKey()`: Returns the pagination token from the last `getAll()`.

## License

MIT
