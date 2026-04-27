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

### 4. Batch Operations

DynoQuery provides `batchWrite` and `batchRead` for processing multiple items across partitions.

```typescript
// 1. Batch Write (Create/Replace multiple items)
const user1 = db.User('john@example.com', 'METADATA');
user1.name = 'John Doe';

const user2 = db.User('jane@example.com', 'METADATA');
user2.name = 'Jane Doe';

await db.batchWrite([user1, user2]);

// 2. Batch Read (Fetch multiple items or index queries)
const userDraft = db.User('john@example.com', 'METADATA');
const categoryQuery = db.findByCategory('ELECTRONICS', 'p123');

const results = await db.batchRead([userDraft, categoryQuery]);

results.forEach(item => {
  console.log(item.__model); // Automatically mapped to models
  if (item.__model === 'User') {
    item.status = 'active';
    item.save(); // Second-level methods are available
  }
});

// 3. Batch Delete
const userToDelete = db.User('john@example.com').draftDelete('METADATA');
await db.batchWrite([userToDelete]);
```

### 5. Transaction Operations

DynoQuery supports `transactWrite` and `transactRead` for atomic operations across multiple items.

```typescript
// 1. Transaction Write (All operations succeed or all fail)
const user1 = db.User('john@example.com', 'METADATA');
user1.name = 'John Doe';

const userToDelete = db.User('olduser@example.com').draftDelete('METADATA');

// You can even set conditions for items in a transaction
const criticalItem = db.User('admin@example.com', 'METADATA');
criticalItem.lastLogin = new Date().toISOString();
criticalItem.setCondition(attr('status').equals('ACTIVE'));

await db.transactWrite([user1, userToDelete, criticalItem]);

// 2. Transaction Read (Read multiple items atomically)
const userDraft = db.User('john@example.com', 'METADATA');
const items = await db.transactRead([userDraft]);

if (items[0]) {
  console.log('Found user:', items[0].name);
}
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

### Expression Builder (Filters & Conditions)

Use `ExpressionBuilder` to build complex filter and condition expressions in a type-safe way.

```typescript
import { attr, ExpressionBuilder } from 'dynoquery';

// 1. Filtering in queries
const builder = attr('age').greaterThan(25).and(attr('status').equals('ACTIVE'));
const activeUsers = await db.User('some-id').getAll({ filterBuilder: builder });

// 2. Conditional Updates
const johnMeta = db.User('john@example.com', 'METADATA');
const condition = attr('version').equals(1);

johnMeta.setCondition(condition);
johnMeta.name = 'John New Name';
johnMeta.version = 2;

await johnMeta.save(); // Fails if version is not 1

// 3. Raw Condition Expressions
await db.User('john@example.com').update({ status: 'INACTIVE' }, [], {
  ConditionExpression: '#v = :v',
  ExpressionAttributeNames: { '#v': 'version' },
  ExpressionAttributeValues: { ':v': 2 }
});

// Or using Item object
johnMeta.setCondition(attr('name').exists());
await johnMeta.save();

// 4. Supported Operators
// - attr('name').equals('val') / notEquals('val')
// - .lessThan(val) / lessThanOrEqual(val)
// - .greaterThan(val) / greaterThanOrEqual(val)
// - .between(start, end)
// - .in([val1, val2])
// - logical: .and(otherBuilder), .or(otherBuilder), ExpressionBuilder.not(builder)

// 4. Supported Functions
// - attr('field').exists()
// - attr('field').notExists()
// - attr('field').type('S')
// - attr('field').beginsWith('prefix')
// - attr('field').contains('value')
// - attr('field').size().greaterThan(5)
```

## API Reference

### DynoQuery
- `create(params)`: Low-level PutCommand wrapper.
- `get(params)`: Low-level GetCommand wrapper.
- `update(params)`: Low-level UpdateCommand wrapper.
- `delete(params)`: Low-level DeleteCommand wrapper.
- `query(params)`: Low-level QueryCommand wrapper.
- `scan(params)`: Low-level ScanCommand wrapper.
- `batchWrite(items)`: Batch persists multiple `Item` objects.
- `batchRead(items)`: Batch fetches multiple `Item` or `IndexQuery` objects.
- `transactWrite(items)`: Performs atomic write operations (Put/Delete) for up to 100 items.
- `transactRead(items)`: Performs atomic read operations (Get) for up to 100 items.
- `[ModelName](id, skValue?)`: Returns a `Partition` instance for the given ID. If `skValue` is provided, returns an `Item` object directly.
- `findBy[IndexName](id, skValue?)`: Returns an `IndexQuery` instance.

### Partition
- `get(skValue)`: Fetches data for a specific Sort Key value (returns a Promise).
- `getAll(options?)`: Fetches items in the partition. Options: `{ limit, exclusiveStartKey, filterBuilder, FilterExpression, ExpressionAttributeNames, ExpressionAttributeValues }`.
- `create(skValue, data, indices?, options?)`: Creates an item. `options`: `{ conditionBuilder, ConditionExpression, ExpressionAttributeNames, ExpressionAttributeValues }`.
- `update(skValue, data, indices?, options?)`: Partial update of an item. `options`: `{ conditionBuilder, ConditionExpression, ExpressionAttributeNames, ExpressionAttributeValues }`.
- `delete(skValue, options?)`: Deletes an item. `options`: `{ conditionBuilder, ConditionExpression, ExpressionAttributeNames, ExpressionAttributeValues }`.
- `draft(skValue, data?)`: Returns an `Item` object initialized with `data` (optional).
- `draftDelete(skValue)`: Returns an `Item` object marked for deletion (for use with `batchWrite`).
- `deleteAll()`: Deletes all items in the partition.
- `getLastEvaluatedKey()`: Returns the pagination token from the last `getAll()`.

### IndexQuery
- `get(skValue?)`: Get a single item from the index.
- `getAll(options?)`: Query index. Options: `{ limit, scanIndexForward, exclusiveStartKey, skValue, filterBuilder, FilterExpression, ExpressionAttributeNames, ExpressionAttributeValues }`.
- `getLastEvaluatedKey()`: Returns the pagination token from the last `getAll()`.

### Item (returned by Partition.get or draft)
- `create(data?, indices?)`: Persists the item as a new record with the provided data. Supports GSI indices and internal `conditionBuilder`.
- `update(data, indices?)`: Partial update of the item. Supports GSI indices and internal `conditionBuilder`.
- `save()`: Persists the current state of the item. Uses indices attached via `setIndex()` and internal `conditionBuilder`.
- `setIndex(indices)`: Attaches one or more `IndexQuery` objects to the item.
- `setFilter(builder)`: Sets a filter expression builder for the item.
- `setCondition(builder)`: Sets a condition for the item using an `ExpressionBuilder`.

## License

MIT
