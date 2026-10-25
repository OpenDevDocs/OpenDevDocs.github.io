---
title: Client-Side Field Level Encryption
slug: client-side-field-level-encryption
metadescription: Learn how MongoDB Client-Side Field Level Encryption (CSFLE) encrypts sensitive fields in your app before they reach the server, with Node.js examples.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'security', 'encryption', 'csfle']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [TLS, Authentication and Network Security](/courses/mongodb/tls-and-authentication) and [Connecting MongoDB to Your First App](/courses/mongodb/connecting-from-an-app).

## What you will learn

By the end of this lesson you will know:

- What **Client-Side Field Level Encryption (CSFLE)** protects you from, compared to TLS and encryption at rest
- How **envelope encryption** works: a **Customer Master Key** protects **Data Encryption Keys**
- The difference between **deterministic** and **random** encryption, and which one you can query
- How to encrypt, store, query and decrypt fields with the Node.js driver
- What runs on MongoDB Community (**explicit** encryption) vs Enterprise and Atlas (**automatic** encryption)

You can try the explicit examples locally with MongoDB Community, Node.js and the driver's encryption package. Automatic encryption needs MongoDB Enterprise or Atlas.

## Why encrypt fields in the app?

You already know two kinds of encryption:

- **TLS** encrypts data while it travels over the network.
- **Encryption at rest** encrypts the database files on disk.

Both are great, but in both cases the **server can read your data**. Anyone with database access, such as a DBA, a cloud provider's support engineer, an attacker who stole an admin password, or a careless backup copy, can see every customer's phone number in plain text.

**CSFLE** encrypts chosen fields **inside your application, before they are sent**. The server only ever stores and sees scrambled bytes. Without the keys, the data is useless, even to a database admin.

> **Think of it like this:** TLS is an armoured van, and encryption at rest is a locked warehouse. But inside the warehouse the boxes are open, so anyone with a warehouse key can read the letters. CSFLE puts each sensitive letter in a sealed envelope **before** it leaves your house. The warehouse stores sealed envelopes and never sees what's inside.

## What it looks like

A `customers` document, as your app sees it:

```javascript
{ name: "Asha Roy", email: "asha@example.com", phone: "+91 98300 12345", city: "Kolkata" }
```

The same document, as stored on the server (and seen by anyone querying without keys):

```javascript
{
  name: "Asha Roy",
  email: Binary.createFromBase64("AU2x8fVQ...", 6),
  phone: Binary.createFromBase64("Aiv4QwRZ...", 6),
  city: "Kolkata"
}
```

The encrypted fields are stored as **BSON Binary subtype 6**, which means "encrypted value". Only the fields you choose are encrypted. `name` and `city` stay readable and indexable.

## The keys: envelope encryption

CSFLE uses two layers of keys.

| Key | What it is | Where it lives |
| --- | --- | --- |
| **Customer Master Key (CMK)** | The "key to the keys" | A **Key Management Service (KMS)**: AWS KMS, Azure Key Vault, Google Cloud KMS, a KMIP server, or a local file for development |
| **Data Encryption Key (DEK)** | The key that actually encrypts your fields | A **key vault collection** in MongoDB, stored **encrypted by the CMK** |

When your app needs to encrypt or decrypt, the driver:

1. Reads the encrypted DEK from the key vault collection
2. Asks the KMS to decrypt the DEK with the CMK
3. Uses the DEK to encrypt or decrypt the field, inside your app

This is called **envelope encryption**: the data is locked with the DEK, and the DEK is locked with the CMK.

> **Think of it like this:** Each drawer in a filing cabinet has its own key (the DEKs). All those drawer keys are kept in a small safe (the key vault), and the safe opens only with one master key (the CMK) that you keep at the bank (the KMS).

> **Warning:** If you lose the CMK, all data encrypted under it is **gone forever**. Nobody, including MongoDB, can recover it. Use a real KMS in production and protect it carefully.

## Deterministic vs random encryption

When you encrypt a field, you pick an **algorithm**:

| Algorithm | Same input gives... | Can you query it? | Good for |
| --- | --- | --- | --- |
| `AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic` | The **same** ciphertext every time | Yes, **equality only** (`{ email: ... }`) | Fields you look up by exact value: email, ID number |
| `AEAD_AES_256_CBC_HMAC_SHA_512-Random` | A **different** ciphertext every time | No | Fields you only read back: phone, address, medical notes |

**Random** is more secure. With deterministic encryption, someone who can see the stored data can still notice that two documents have the **same** email, or count how often a value appears. For low-variety fields (like `gender` or `bloodGroup`) that leaks a lot, so use random for them.

Deterministic encryption also doesn't support some types, such as booleans, doubles, objects and arrays.

> **Note:** If you need range queries (`$gt`, `$lt`) or stronger protection for queried fields, look at **Queryable Encryption** in the next lesson.

## Explicit vs automatic encryption

| | Explicit encryption | Automatic encryption |
| --- | --- | --- |
| How | You call `encrypt()` and `decrypt()` in your code | You describe which fields to encrypt; the driver does it on every read and write |
| Code changes | More | Fewer |
| Editions | Community, Enterprise, Atlas | **Enterprise and Atlas** only |
| Extra pieces | Driver encryption library | Driver encryption library + the **Automatic Encryption Shared Library** (`crypt_shared`) |

We'll build the explicit version first, because you can run it on a free local server.

## Setup in Node.js

Install the driver and its encryption add-on:

```bash
npm install mongodb mongodb-client-encryption
```

Explicit CSFLE works on a standalone local server, which is fine for learning. The snippets below use `await`, so run them inside an `async` function.

### Step 1: create a local master key (development only)

For learning, we'll use the `local` KMS provider: a 96-byte random key in a file.

```javascript
// make-master-key.js
const fs = require("fs");
const crypto = require("crypto");

fs.writeFileSync("master-key.txt", crypto.randomBytes(96));
console.log("Saved master-key.txt");
```

> **Warning:** A key file on disk is fine on your laptop and wrong in production. In production, the CMK lives in a KMS, and your app only has permission to **use** it.

### Step 2: prepare the key vault

The key vault is a normal collection. By convention it's `encryption.__keyVault`. Add a unique index so key names can't repeat:

```javascript
const { MongoClient, ClientEncryption } = require("mongodb");
const fs = require("fs");

const uri = "mongodb://localhost:27017";
const keyVaultNamespace = "encryption.__keyVault";
const kmsProviders = { local: { key: fs.readFileSync("master-key.txt") } };

const client = new MongoClient(uri);
await client.connect();

await client.db("encryption").collection("__keyVault").createIndex(
  { keyAltNames: 1 },
  { unique: true, partialFilterExpression: { keyAltNames: { $exists: true } } }
);
```

### Step 3: create a data encryption key

```javascript
const encryption = new ClientEncryption(client, { keyVaultNamespace, kmsProviders });

const dataKeyId = await encryption.createDataKey("local", {
  keyAltNames: ["customerKey"]
});
console.log(dataKeyId);
// → new UUID("3f1c2a7e-8b4d-4e2a-9c61-0d5f7b2e9a11")
```

`keyAltNames` gives the key a friendly name, so later you can refer to it as `"customerKey"` instead of the UUID.

## Encrypting and storing

Let's encrypt `email` deterministically (so we can search by it) and `phone` randomly (most secure):

```javascript
const DET = "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic";
const RND = "AEAD_AES_256_CBC_HMAC_SHA_512-Random";

const customers = client.db("shop").collection("customers");

await customers.insertOne({
  name: "Asha Roy",
  city: "Kolkata",
  email: await encryption.encrypt("asha@example.com", { keyAltName: "customerKey", algorithm: DET }),
  phone: await encryption.encrypt("+91 98300 12345", { keyAltName: "customerKey", algorithm: RND })
});
```

Look at it in mongosh, with a normal connection:

```javascript
db.getSiblingDB("shop").customers.findOne({ name: "Asha Roy" })
// → { _id: ObjectId('...'), name: 'Asha Roy', city: 'Kolkata',
//     email: Binary.createFromBase64('AT8cKn6LTU4qnGENX3suma...', 6),
//     phone: Binary.createFromBase64('Aj8cKn6LTU4qnGENX3suma...', 6) }
```

The server and anyone using mongosh see only ciphertext.

## Querying and decrypting

To find Asha by email, encrypt the search value the **same way** (deterministic, same key). The server compares ciphertext to ciphertext:

```javascript
const encryptedEmail = await encryption.encrypt("asha@example.com", {
  keyAltName: "customerKey",
  algorithm: DET
});

const doc = await customers.findOne({ email: encryptedEmail });

console.log(await encryption.decrypt(doc.email)); // → asha@example.com
console.log(await encryption.decrypt(doc.phone)); // → +91 98300 12345
```

Querying `phone` this way would find nothing, because random encryption gives a different ciphertext every time.

### Automatic decryption (works on Community too)

Calling `decrypt()` on every field gets tiring. You can create a client that **decrypts automatically** while you still encrypt explicitly. Set `bypassAutoEncryption: true`:

```javascript
const autoDecryptClient = new MongoClient(uri, {
  autoEncryption: { keyVaultNamespace, kmsProviders, bypassAutoEncryption: true }
});

const plain = await autoDecryptClient.db("shop").collection("customers")
  .findOne({ name: "Asha Roy" });
// → { name: 'Asha Roy', city: 'Kolkata', email: 'asha@example.com', phone: '+91 98300 12345', ... }
```

## Automatic encryption (Enterprise and Atlas)

With MongoDB Enterprise or Atlas you can skip the `encrypt()` calls entirely. You give the driver a **schema map**, a JSON Schema that says which fields to encrypt and how:

```javascript
const schemaMap = {
  "shop.customers": {
    bsonType: "object",
    encryptMetadata: { keyId: [dataKeyId] },
    properties: {
      email: { encrypt: { bsonType: "string", algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic" } },
      phone: { encrypt: { bsonType: "string", algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random" } }
    }
  }
};

const secureClient = new MongoClient(uri, {
  autoEncryption: {
    keyVaultNamespace,
    kmsProviders,
    schemaMap,
    extraOptions: { cryptSharedLibPath: "/opt/mongodb/lib/mongo_crypt_v1.so" }
  }
});

const col = secureClient.db("shop").collection("customers");
await col.insertOne({ name: "Rahul Sen", email: "rahul@example.com", phone: "+91 90000 11111" });
const rahul = await col.findOne({ email: "rahul@example.com" }); // plain query, encrypted for you
```

Your code reads and writes plain values. The driver uses the **Automatic Encryption Shared Library** (`crypt_shared`, a download from MongoDB) to work out which fields to encrypt in each command.

> **Tip:** You can also put the same `encrypt` rules in the collection's `$jsonSchema` validator on the server. Then the server **rejects** any write where those fields arrive unencrypted, protecting you from a misconfigured client.

## Key management tasks

- **Rotate the master key:** `encryption.rewrapManyDataKey()` re-encrypts your DEKs with a new CMK. The data itself doesn't change.
- **Delete a customer's data for good:** give each customer (or tenant) their **own** DEK. Deleting that DEK from the key vault makes their encrypted fields unreadable everywhere, even in old backups. This is called **crypto-shredding**.
- **Restrict who can read the key vault:** use roles so only the app's user can read `encryption.__keyVault`.

## Limitations to know

- Encrypted fields can't be sorted, used in range queries, or indexed for anything except deterministic equality.
- Aggregations can't compute on encrypted values (no `$sum` of an encrypted salary on the server).
- Your app needs network access to the KMS, and losing the CMK means losing the data.
- Every app that reads the data must be configured with the keys and the encryption library.

## Common mistakes

- **Encrypting low-variety fields deterministically.** Fields like `gender` or `isMember` reveal patterns. Use random encryption, or don't query them.
- **Querying a randomly encrypted field.** It never matches. Use deterministic encryption (or Queryable Encryption) for fields you search by.
- **Keeping the local master key in Git or next to the database.** Anyone with the file and the data can decrypt everything. Use a KMS in production.
- **Expecting automatic encryption on Community.** It needs Enterprise or Atlas. On Community, use explicit encryption (with automatic decryption).
- **Changing the encryption algorithm or key for existing documents** and then wondering why queries miss old data. Re-encrypt old documents when you change the setup.

## Practice

1. Which algorithm would you choose for each `customers` field: `email`, `phone`, `bloodGroup`, `aadhaarNumber` (searched by exact value)?
2. Write the Node.js code to encrypt `"Maria Gomez"` with the `customerKey` key using random encryption.
3. Write a `findOne` that finds the customer with email `rahul@example.com` when `email` was encrypted deterministically with `customerKey`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. email: Deterministic (searched by exact value)
//    phone: Random (only read back)
//    bloodGroup: Random (few possible values would leak patterns)
//    aadhaarNumber: Deterministic (exact lookups), or Queryable Encryption for stronger protection

// 2. Random encryption
const encName = await encryption.encrypt("Maria Gomez", {
  keyAltName: "customerKey",
  algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random"
});

// 3. Deterministic lookup
const searchValue = await encryption.encrypt("rahul@example.com", {
  keyAltName: "customerKey",
  algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic"
});
const doc = await customers.findOne({ email: searchValue });
```

</details>

## Key takeaways

- **CSFLE** encrypts chosen fields **in the application** before they reach MongoDB, so the server and its admins only see ciphertext.
- **Envelope encryption**: a **CMK** in a KMS protects **DEKs** stored in a key vault collection; DEKs encrypt the fields.
- **Deterministic** encryption allows equality queries; **random** encryption is stronger but can't be queried.
- **Explicit** encryption (and automatic decryption) works on Community. **Automatic** encryption needs Enterprise or Atlas plus `crypt_shared`.
- Lose the CMK and the data is gone. Use a real KMS, restrict the key vault, and consider per-customer keys for crypto-shredding.

**Next lesson:** [Queryable Encryption](/courses/mongodb/queryable-encryption)
