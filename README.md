# DynoQuery

A lightweight wrapper for Amazon DynamoDB using the AWS SDK v3, specifically designed for **Single-Table Design** patterns.

## Installation

```bash
npm install dynoquery
```

## Features

- Basic CRUD operations (create, get, update, delete)
- Optimized for **Single-Table Design** (Partitions and GSIs)
- Automatic result mapping to partition models
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

#### Second-Level Objects (Single-Row Operations)

For a more flexible way to work with individual rows, you can use `draft()` and `get()` to obtain an `Item` object, then call `create()`, `update()`, or `save()` on it directly. You can also use a shorthand by passing a second argument to your model function (as shown in the examples below).

```typescript
const john = db.User('john@example.com');

// 1. Create a new row
const johnMeta = john.draft('METADATA');
johnMeta.name = 'John Doe';
johnMeta.email = 'johndoe@johnmail.com';
await johnMeta.save();

// 2. Create with properties in arguments
const johnStat = john.draft('STAT');
await johnStat.create({ views: 100 });

// 3. Get and update an existing row
const johnBio = await john.get('BIO');
johnBio.birthYear = 1986;
await johnBio.save();

// 4. Partial update without fetching
const johnFriend1 = john.draft('FRIEND#1');
await johnFriend1.update({ Name: 'Alice', rank: 1 });

// 5. Set properties during initialization
const johnPref = john.draft('PREF', { theme: 'dark' });
await johnPref.save();

// 6. Shorthand access (returns an Item object directly)
const johnMeta = db.User('john@example.com', 'METADATA');
await johnMeta.update({ name: 'John Doe' });
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
  
  // If results match a registered item prefix, they are automatically mapped
  items.forEach(async item => {
    if (item.__model === 'Product') {
      const productPartition = item.getPartition(); // Returns a Partition instance
      
      // Now you can also edit and save directly if it matches a item
      item.price = 45;
      await item.save();
    }
  });
}
```

### 3. Creating Items with GSI Support

You can pass index queries directly to `create()` or `update()` to automatically populate GSI attributes. This works on both the Partition level and the Item level.

#### Using Partition.create() and Partition.update()
```typescript
const electronics = db.findByCategory('ELECTRONICS', 'RANK#1');

// This will automatically set GSI1PK='CAT#ELECTRONICS' and GSI1SK='RANK#1'
await db.Product('p123').create('INFO', { 
  name: 'Gaming Mouse',
  price: 50
}, [electronics]);

// Partial update with GSI support
await db.Product('p123').update('INFO', { price: 45 }, [electronics]);
```

#### Using Item.create() and Item.update()
```typescript
const electronics = db.findByCategory('ELECTRONICS', 'RANK#1');
const mouse = db.Product('p123', 'INFO');

// Pass data and indices directly to create()
await mouse.create({ 
  name: 'Gaming Mouse', 
  price: 50 
}, [electronics]);

// Or use update() directly on the item for partial updates
await mouse.update({ price: 40 }, [electronics]);
```

#### Using setIndex() for persistence
You can also use `setIndex()` to attach indices to an item so they are used automatically whenever you call `save()`.

```typescript
const electronics = db.findByCategory('ELECTRONICS', 'RANK#1');
const mouse = db.Product('p123', 'INFO');

mouse.setIndex(electronics);
mouse.price = 50;

// save() will now automatically include GSI attributes from the attached index
await mouse.save();
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
- `[ModelName](id, skValue?)`: Returns a `Partition` instance for the given ID. If `skValue` is provided, returns an `Item` object directly.
- `findBy[IndexName](id, skValue?)`: Returns an `IndexQuery` instance.

### Partition
- `get(skValue)`: Fetches data for a specific Sort Key value (returns a Promise).
- `getAll(options?)`: Fetches items in the partition. Options: `{ limit, exclusiveStartKey }`.
- `create(skValue, data, indices?)`: Creates an item. `indices` is an array of `IndexQuery` for GSI population.
- `update(skValue, data)`: Partial update of an item.
- `delete(skValue)`: Deletes an item.
- `draft(skValue, data?)`: Returns an `Item` object initialized with `data` (optional).
- `deleteAll()`: Deletes all items in the partition.
- `getLastEvaluatedKey()`: Returns the pagination token from the last `getAll()`.

### IndexQuery
- `get(skValue?)`: Get a single item from the index.
- `getAll(options?)`: Query index. Options: `{ limit, scanIndexForward, exclusiveStartKey, skValue }`.
- `getLastEvaluatedKey()`: Returns the pagination token from the last `getAll()`.

### Item (returned by Partition.get or draft)
- `create(data?, indices?)`: Persists the item as a new record with the provided data. Supports GSI indices.
- `update(data, indices?)`: Partial update of the item. Supports GSI indices.
- `save()`: Persists the current state of the item (alias for update of all properties). Uses indices attached via `setIndex()`.
- `setIndex(indices)`: Attaches one or more `IndexQuery` objects to the item for use with `save()` or `create()`.

## License

MIT
