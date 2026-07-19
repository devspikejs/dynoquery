# DynoQuery

[![npm version](https://img.shields.io/npm/v/dynoquery.svg)](https://www.npmjs.com/package/dynoquery)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight wrapper for Amazon DynamoDB using the AWS SDK v3, specifically designed for **Single-Table Design** patterns.

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Quick Start](#quick-start)
  - [1. Working with Partitions (Models)](#1-working-with-partitions-models)
  - [2. Global Secondary Indexes (findBy)](#2-global-secondary-indexes-findby)
  - [3. Creating Items with GSI Support](#3-creating-items-with-gsi-support)
  - [4. Batch Operations](#4-batch-operations)
  - [5. Transaction Operations](#5-transaction-operations)
  - [6. Time To Live (TTL)](#6-time-to-live-ttl)
- [Configuration](#configuration)
  - [DynoQuery Options](#dynoquery-options)
  - [findBy Index Options](#findby-index-options)
- [Advanced Usage](#advanced-usage)
  - [Pagination](#pagination)
  - [Expression Builder](#expression-builder)
- [API Reference](#api-reference)
- [License](#license)

## Installation

```bash
npm install dynoquery
```

## Features

- Basic CRUD operations (create, get, update, delete)
- Optimized for **Single-Table Design** (Partitions and GSIs)
- Automatic result mapping to partition models
- Built-in caching for partition instances
- Batch operations with automatic chunking
- Transaction support with atomicity guarantees (100-item limit enforced)
- TypeScript support

## Quick Start

Initialize the client with your table name and define your models.

```typescript
import { DynoQuery } from 'dynoquery';

const db = new DynoQuery({
  region: 'us-east-1',
  tableName: 'MyTable'
});
```

### 1. Working with Partitions (Models)

Define models to handle different entity types within your single table. Each model maps to a PK prefix (e.g. `USER#john@example.com`).

```typescript
const db = new DynoQuery({
  region: 'us-east-1',
  tableName: 'MyTable',
  models: {
    User: { pkPrefix: 'USER#' },    // PK: USER#<id>
    Product: { pkPrefix: 'PROD#' }  // PK: PROD#<id>
  }
});

async function userExample() {
  const john = db.User('john@example.com'); // PK: USER#john@example.com

  // Create an item (SK: PROFILE)
  await john.create('PROFILE', { name: 'John Doe', email: 'john@example.com' });

  // Get an item (uses cache if already loaded)
  const profile = await john.get('PROFILE');
  console.log(profile.name); // 'John Doe'

  // Update an item (partial update — merges with existing data)
  await john.update('PROFILE', { theme: 'dark' });

  // Delete an item
  await john.delete('PROFILE');

  // Update an item with UpdateExpression
  const johnMeta = john.draft('METADATA');
  johnMeta.updateAction({
    UpdateExpression: 'SET #name = :name',
    ExpressionAttributeNames: { '#name': 'name' },
    ExpressionAttributeValues: { ':name': 'John Updated' }
  });
  await johnMeta.save();

  // Fetch all items in this partition
  const allData = await john.getAll();
}
```

#### Item Objects (Single-Row Operations)

For fine-grained control over individual rows, use `draft()` to get an `Item` object and call `save()` on it directly. Pass a second argument to the model function as a shorthand.

```typescript
const john = db.User('john@example.com'); // PK: USER#john@example.com

// 1. Create a new row via draft
const johnMeta = john.draft('METADATA');
johnMeta.name = 'John Doe';
johnMeta.email = 'johndoe@johnmail.com';
await johnMeta.save();

// 2. Draft with initial properties
const johnStat = john.draft('STAT', { views: 100 });
await johnStat.save();

// 3. Get an existing row, modify, and save
const johnBio = await john.get('BIO');
johnBio.birthYear = 1986;
await johnBio.save();

// 4. Shorthand: pass SK as second argument to get an Item directly
const johnPref = db.User('john@example.com', 'PREF'); // PK: USER#john@example.com, SK: PREF
johnPref.theme = 'dark';
await johnPref.save();

// 5. Update with UpdateExpression (non-transactional)
const johnUpdate = db.User('john@example.com', 'BIO');
johnUpdate.updateAction({
  UpdateExpression: 'SET #v = #v + :inc',
  ExpressionAttributeNames: { '#v': 'version' },
  ExpressionAttributeValues: { ':inc': 1 }
});
await johnUpdate.save();
```

### 2. Global Secondary Indexes (findBy)

Use `findBy` to query GSIs. By default, the GSI PK attribute name is `{indexName}PK` and the SK attribute name is `{indexName}SK`.

```typescript
const db = new DynoQuery({
  region: 'us-east-1',
  tableName: 'MyTable',
  models: {
    Product: { pkPrefix: 'PROD#' }
  },
  findBy: {
    Category: { indexName: 'GSI1', pkPrefix: 'CAT#' }
    // pkName defaults to 'GSI1PK', skName defaults to 'GSI1SK'
  }
});

async function indexExample() {
  const electronics = db.findByCategory('ELECTRONICS'); // GSI1PK: CAT#ELECTRONICS

  // Get all items in this category
  const items = await electronics.getAll();

  // Results are automatically mapped to registered models
  items.forEach(async item => {
    if (item.__model === 'Product') {
      const productPartition = item.getPartition();

      item.price = 45;
      await item.save();
    }
  });
}
```

> **Note:** When passing a `skValue` to `getAll()`, it filters using `begins_with` on the sort key. For example, `getAll({ skValue: 'RANK#' })` returns all items whose GSI SK starts with `RANK#`.

### 3. Creating Items with GSI Support

Pass index query objects to `create()` or `update()` to automatically populate GSI attributes.

#### Using Partition.create() and Partition.update()

```typescript
const electronics = db.findByCategory('ELECTRONICS', 'RANK#1'); // GSI1PK: CAT#ELECTRONICS, GSI1SK: RANK#1

await db.Product('p123').create('INFO', { // PK: PROD#p123
  name: 'Gaming Mouse',
  price: 50
}, [electronics]);

// Partial update with GSI support
await db.Product('p123').update('INFO', { price: 45 }, [electronics]); // PK: PROD#p123
```

#### Using setIndex() for Persistence

Attach indices to an `Item` so they are included automatically on every `save()`.

```typescript
const electronics = db.findByCategory('ELECTRONICS', 'RANK#1'); // GSI1PK: CAT#ELECTRONICS, GSI1SK: RANK#1
const mouse = db.Product('p123', 'INFO'); // PK: PROD#p123, SK: INFO

mouse.setIndex(electronics);
mouse.price = 50;

// GSI attributes are included automatically
await mouse.save();
```

### 4. Batch Operations

`batchWrite` and `batchRead` handle multiple items across partitions. Requests are automatically chunked to respect DynamoDB limits (25 per write, 100 per read).

```typescript
// 1. Batch Write (create/replace multiple items)
const user1 = db.User('john@example.com', 'METADATA'); // PK: USER#john@example.com, SK: METADATA
user1.name = 'John Doe';

const user2 = db.User('jane@example.com', 'METADATA'); // PK: USER#jane@example.com, SK: METADATA
user2.name = 'Jane Doe';

await db.batchWrite([user1, user2]);

// 2. Batch Read (fetch multiple items or index queries)
const userDraft = db.User('john@example.com', 'METADATA'); // PK: USER#john@example.com, SK: METADATA
const categoryQuery = db.findByCategory('ELECTRONICS', 'p123'); // GSI1PK: CAT#ELECTRONICS, GSI1SK: p123

const results = await db.batchRead([userDraft, categoryQuery]);

results.forEach(item => {
  console.log(item.__model); // Automatically mapped to models
  if (item.__model === 'User') {
    item.status = 'active';
    item.save();
  }
});

// 3. Batch Delete
const userToDelete = db.User('john@example.com').draftDelete('METADATA'); // PK: USER#john@example.com
await db.batchWrite([userToDelete]);
```

### 5. Transaction Operations

`transactWrite` and `transactRead` perform atomic operations — all items succeed or all fail together. DynamoDB limits a single transaction to 100 items; exceeding this throws an error.

```typescript
// 1. Transaction Write (all operations succeed or all fail)
const user1 = db.User('john@example.com', 'METADATA'); // PK: USER#john@example.com, SK: METADATA
user1.name = 'John Doe';

const userToDelete = db.User('olduser@example.com').draftDelete('METADATA'); // PK: USER#olduser@example.com

// Conditional write: only succeeds if status is 'ACTIVE'
const criticalItem = db.User('admin@example.com', 'METADATA'); // PK: USER#admin@example.com, SK: METADATA
criticalItem.lastLogin = new Date().toISOString();
criticalItem.setCondition(attr('status').equals('ACTIVE'));

// 4. Update operation in transaction
const userToUpdate = db.User('john@example.com').draft('METADATA');
userToUpdate.updateAction({
  UpdateExpression: 'SET #name = :name',
  ExpressionAttributeNames: { '#name': 'name' },
  ExpressionAttributeValues: { ':name': 'John Updated' }
});

await db.transactWrite([user1, userToDelete, criticalItem, userToUpdate]);

// 2. Transaction Read (read multiple items atomically)
const userDraft = db.User('john@example.com', 'METADATA'); // PK: USER#john@example.com, SK: METADATA
const items = await db.transactRead([userDraft]);

if (items[0]) {
  console.log('Found user:', items[0].name);
}
```

### 6. Time To Live (TTL)

Configure `ttlAttributeName` to enable TTL support. DynoQuery sets the TTL value on items — you must separately enable TTL on the DynamoDB table itself (via the AWS Console, CLI, or CloudFormation).

```typescript
const db = new DynoQuery({
  region: 'us-east-1',
  tableName: 'MyTable',
  ttlAttributeName: 'expireAt'
});

async function ttlExample() {
  const session = db.User('john@example.com').draft('SESSION'); // PK: USER#john@example.com

  // Set TTL to 1 hour from now (Unix timestamp in seconds)
  const ttl = Math.floor(Date.now() / 1000) + 3600;
  session.ttl(ttl);

  session.data = 'some session data';
  await session.save();
}
```

## Configuration

### DynoQuery Options

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tableName` | `string` | - | The DynamoDB table name. |
| `region` | `string` | - | AWS region. |
| `pkName` | `string` | `'PK'` | Attribute name for the table Partition Key. |
| `skName` | `string` | `'SK'` | Attribute name for the table Sort Key. |
| `pkPrefix` | `string` | `''` | Global prefix for all partition keys (useful for multitenancy, e.g., `TENANT#A#`). |
| `ttlAttributeName` | `string` | - | Attribute name configured for DynamoDB TTL. |
| `endpoint` | `string` | - | Custom endpoint for local development (e.g., `http://localhost:8000`). |
| `credentials` | `object` | - | AWS credentials `{ accessKeyId, secretAccessKey, sessionToken? }`. |
| `models` | `object` | - | Map of model names to `{ pkPrefix: string }`. |
| `findBy` | `object` | - | Map of index names to index config (see below). |

```typescript
const db = new DynoQuery({
  region: 'us-east-1',
  tableName: 'MyTable',
  pkName: 'PartitionKey',
  skName: 'SortKey',
  pkPrefix: 'TENANT#A#',
  endpoint: 'http://localhost:8000',
  credentials: {
    accessKeyId: 'MY_ACCESS_KEY',
    secretAccessKey: 'MY_SECRET_KEY'
  }
});
```

### findBy Index Options

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `indexName` | `string` | Required | The DynamoDB index name (e.g., `'GSI1'`). |
| `pkName` | `string` | `'{indexName}PK'` | Attribute name for the GSI partition key. |
| `skName` | `string` | `'{indexName}SK'` | Attribute name for the GSI sort key. |
| `pkPrefix` | `string` | `''` | Prefix applied to PK values for this index. |

```typescript
const db = new DynoQuery({
  // ...
  findBy: {
    // GSI1PK / GSI1SK auto-derived from indexName
    Category: { indexName: 'GSI1', pkPrefix: 'CAT#' },

    // Override attribute names explicitly
    Status: { indexName: 'StatusIndex', pkName: 'StatusPK', skName: 'StatusSK' }
  }
});
```

## Advanced Usage

### Pagination

Both `Partition.getAll()` and `IndexQuery.getAll()` support pagination via `Limit` and `ExclusiveStartKey`.

```typescript
const index = db.findByCategory('ELECTRONICS'); // GSI1PK: CAT#ELECTRONICS
const items = await index.getAll({ Limit: 10 });

const token = index.getLastEvaluatedKey();
if (token) {
  const nextItems = await index.getAll({ Limit: 10, ExclusiveStartKey: token });
}
```

Use `ScanIndexForward: false` to return results in descending sort key order:

```typescript
const latest = await index.getAll({ Limit: 5, ScanIndexForward: false });
```

### Projections

Use `ProjectionExpression` to fetch only specific attributes. This is highly recommended for performance when dealing with large items.

```typescript
const items = await index.getAll({ 
  ProjectionExpression: 'name, email, age' 
});
```

### Expression Builder

Use `attr()` and `ExpressionBuilder` to build type-safe filter and condition expressions.

```typescript
import { attr, ExpressionBuilder } from 'dynoquery';

// 1. Filtering in queries
const builder = attr('age').greaterThan(25).and(attr('status').equals('ACTIVE'));
const activeUsers = await db.User('some-id').getAll({ filterBuilder: builder }); // PK: USER#some-id

// 2. Conditional save — fails if version is not 1
const johnMeta = db.User('john@example.com', 'METADATA'); // PK: USER#john@example.com, SK: METADATA
johnMeta.setCondition(attr('version').equals(1));
johnMeta.name = 'John New Name';
johnMeta.version = 2;
await johnMeta.save();

// 3. Conditional create/update on the Partition level
await db.User('john@example.com').create('METADATA', { name: 'John' }, [], { // PK: USER#john@example.com
  conditionBuilder: attr('email').notExists()
});

// 4. NOT combinator
const notPremium = ExpressionBuilder.not(attr('tier').equals('PREMIUM'));
const users = await db.User('some-id').getAll({ filterBuilder: notPremium }); // PK: USER#some-id
```

**Supported operators:**

| Method | DynamoDB Expression |
| :--- | :--- |
| `.equals(val)` | `= val` |
| `.notEquals(val)` | `<> val` |
| `.lessThan(val)` | `< val` |
| `.lessThanOrEqual(val)` | `<= val` |
| `.greaterThan(val)` | `> val` |
| `.greaterThanOrEqual(val)` | `>= val` |
| `.between(start, end)` | `BETWEEN start AND end` |
| `.in([val1, val2])` | `IN (val1, val2)` |
| `.and(otherBuilder)` | `(a) AND (b)` |
| `.or(otherBuilder)` | `(a) OR (b)` |
| `ExpressionBuilder.not(builder)` | `NOT (a)` |

**Supported functions:**

| Method | DynamoDB Function |
| :--- | :--- |
| `attr('field').exists()` | `attribute_exists(field)` |
| `attr('field').notExists()` | `attribute_not_exists(field)` |
| `attr('field').type('S')` | `attribute_type(field, 'S')` |
| `attr('field').beginsWith('prefix')` | `begins_with(field, 'prefix')` |
| `attr('field').contains('value')` | `contains(field, 'value')` |
| `attr('field').size().greaterThan(5)` | `size(field) > 5` |

## API Reference

### DynoQuery

| Method | Description |
| :--- | :--- |
| `[ModelName](id, skValue?)` | Returns a `Partition` for the given ID. If `skValue` is provided, returns an `Item` directly. |
| `findBy[IndexName](id, skValue?)` | Returns an `IndexQuery` for the given ID. |
| `batchWrite(items)` | Persists multiple `Item` objects. Auto-chunks at 25 per DynamoDB limit. |
| `batchRead(items)` | Fetches multiple `Item` objects. Auto-chunks at 100 per DynamoDB limit. |
| `transactWrite(items)` | Atomic write (Put/Update/Delete). Throws if more than 100 items are provided. |
| `transactRead(items)` | Atomic read (Get). Throws if more than 100 items are provided. |
| `create(params)` | Low-level `PutCommand` wrapper. |
| `get(params)` | Low-level `GetCommand` wrapper. |
| `update(params)` | Low-level `UpdateCommand` wrapper. |
| `delete(params)` | Low-level `DeleteCommand` wrapper. |
| `query(params)` | Low-level `QueryCommand` wrapper. |
| `scan(params)` | Low-level `ScanCommand` wrapper. |

### Partition

| Method | Description |
| :--- | :--- |
| `get(skValue)` | Fetches a single item by SK. Returns an `Item` or `null`. |
| `getAll(options?)` | Queries all items in the partition. Options: `Limit`, `ExclusiveStartKey`, `filterBuilder`, `FilterExpression`, `ProjectionExpression`, `ExpressionAttributeNames`, `ExpressionAttributeValues`. |
| `create(skValue, data, indices?, options?)` | Creates/replaces an item. `options`: `conditionBuilder`, `ConditionExpression`, `ExpressionAttributeNames`, `ExpressionAttributeValues`. |
| `update(skValue, data, indices?, options?)` | Merges `data` with existing item and saves. Same `options` as `create`. |
| `delete(skValue, options?)` | Deletes an item by SK. Same `options` as `create`. |
| `draft(skValue, data?)` | Returns an unsaved `Item` initialized with optional `data`. |
| `draftDelete(skValue)` | Returns an `Item` marked for deletion (for use with `batchWrite`). |
| `deleteAll()` | Deletes all items in the partition. |
| `getLastEvaluatedKey()` | Returns the pagination token from the last `getAll()`. |

### IndexQuery

| Method | Description |
| :--- | :--- |
| `getAll(options?)` | Queries the index. Options: `Limit`, `ScanIndexForward`, `ExclusiveStartKey`, `skValue` (uses `begins_with`), `filterBuilder`, `FilterExpression`, `ProjectionExpression`, `ExpressionAttributeNames`, `ExpressionAttributeValues`. |
| `get(skValue?)` | Returns the first item matching the optional SK prefix. |
| `getLastEvaluatedKey()` | Returns the pagination token from the last `getAll()`. |

### Item

| Method | Description |
| :--- | :--- |
| `save()` | Persists the item. Includes any attached indices and condition. |
| `ttl(timestamp)` | Sets the TTL attribute value (requires `ttlAttributeName` in config). |
| `getData()` | Returns a plain object with only the item's data attributes. |
| `setIndex(index)` | Attaches one or more `IndexQuery` objects (included on every `save()`). |
| `setFilter(builder)` | Sets a filter expression builder for the item. |
| `setCondition(builder)` | Sets a condition expression applied on `save()`. |
| `getPartition()` | Returns the parent `Partition` instance. |

## License

MIT
