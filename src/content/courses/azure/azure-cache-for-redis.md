---
publishDate: 2026-10-15T09:50
title: Azure Cache for Redis
slug: azure-cache-for-redis
metadescription: Add Azure Cache for Redis to reduce database load, choose a tier, and avoid the caching mistakes that cause outages.
updateDate: 2026-09-07T09:50
author: ['bishal-biswas']
level: 2
tags: ['databases', 'redis', 'caching']
course: azure
---

## What it is for

An in memory key value store. Reads that would hit a database in tens of milliseconds hit Redis in under one.

```text
Cache aside     check Redis, fall back to the database, store the result
Session state   shared across instances, so any instance serves any user
Distributed lock  one worker does a job, not all of them
Rate limiting   counters with expiry
Pub sub         lightweight fan out, not a durable message broker
```

## Tiers

```bash
az redis create \
  --name redis-shop --resource-group rg-shop-prod-uks \
  --location uksouth --sku Standard --vm-size c1 \
  --minimum-tls-version 1.2 --redis-version 6
```

```text
Basic     one node, NO SLA, no replication. Development only.
Standard  two nodes with replication, 99.9 percent SLA. Most production.
Premium   clustering, persistence, vnet injection, zone redundancy, geo replication
Enterprise  Redis Enterprise modules, active geo replication, higher SLA
```

**Basic has no replication.** A node restart loses everything and the cache is unavailable. That is fine for development and not for production, even for a cache.

## Cache aside

```csharp
public async Task<Product?> GetProductAsync(int id)
{
    var key = $"product:{id}";
    var cached = await _cache.StringGetAsync(key);

    if (cached.HasValue)
    {
        return JsonSerializer.Deserialize<Product>(cached!);
    }

    var product = await _repository.GetAsync(id);
    if (product is null)
    {
        return null;
    }

    await _cache.StringSetAsync(
        key,
        JsonSerializer.Serialize(product),
        TimeSpan.FromMinutes(10));

    return product;
}
```

**Always set an expiry.** A cache without expiry is a second database with no backup and no consistency guarantee, and it fills up.

Ten minutes, an hour, a day: the right value depends on how stale the data may be. Something is almost always better than nothing.

## The connection must be shared

```csharp
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var options = ConfigurationOptions.Parse(
        builder.Configuration.GetConnectionString("Redis")!);
    options.AbortOnConnectFail = false;
    options.ConnectRetry = 3;
    options.ConnectTimeout = 5000;
    return ConnectionMultiplexer.Connect(options);
});

builder.Services.AddSingleton<IDatabase>(sp =>
    sp.GetRequiredService<IConnectionMultiplexer>().GetDatabase());
```

`ConnectionMultiplexer` is expensive to create and designed to be shared. Creating one per request exhausts connections and produces timeouts that look like Redis being slow.

This is the single most common mistake with Redis in .NET, and it is a one line fix.

`AbortOnConnectFail = false` lets the application start when Redis is briefly unavailable and reconnect later, rather than failing at startup.

## Connecting with Entra ID

```bash
az redis access-policy-assignment create \
  --name redis-shop --resource-group rg-shop-prod-uks \
  --policy-name "Data Contributor" \
  --object-id "$PRINCIPAL_ID" --object-id-alias shop-api \
  --access-policy-assignment-name shop-api-assignment
```

```csharp
var configuration = await ConfigurationOptions.Parse("redis-shop.redis.cache.windows.net:6380")
    .ConfigureForAzureWithTokenCredentialAsync(new DefaultAzureCredential());
configuration.Ssl = true;

var multiplexer = await ConnectionMultiplexer.ConnectAsync(configuration);
```

Entra ID authentication removes the access key. The helper handles token refresh, which matters because tokens expire and a long lived connection needs re-authentication.

Disable access keys once everything uses identity:

```bash
az redis update --name redis-shop --resource-group rg-shop-prod-uks \
  --set disableAccessKeyAuthentication=true
```

## Distributed cache in ASP.NET Core

```csharp
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "shop:";
});

// output caching backed by Redis
builder.Services.AddOutputCache();
```

```csharp
public class ProductService(IDistributedCache cache, IProductRepository repository)
{
    public async Task<Product?> GetAsync(int id)
    {
        var key = $"product:{id}";
        var bytes = await cache.GetAsync(key);
        if (bytes is not null)
        {
            return JsonSerializer.Deserialize<Product>(bytes);
        }

        var product = await repository.GetAsync(id);
        if (product is null) return null;

        await cache.SetAsync(key, JsonSerializer.SerializeToUtf8Bytes(product),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),
                SlidingExpiration = TimeSpan.FromMinutes(2)
            });

        return product;
    }
}
```

Set an absolute expiration alongside any sliding expiration. Sliding alone means a frequently read key never expires and never refreshes.

## Cache stampede

When a popular key expires, every request misses simultaneously and they all hit the database at once. A cache that was protecting the database now amplifies load onto it.

```csharp
private static readonly SemaphoreSlim _lock = new(1, 1);

public async Task<Product?> GetProductAsync(int id)
{
    var key = $"product:{id}";
    var cached = await _cache.StringGetAsync(key);
    if (cached.HasValue) return JsonSerializer.Deserialize<Product>(cached!);

    await _lock.WaitAsync();
    try
    {
        // check again: another thread may have populated it while we waited
        cached = await _cache.StringGetAsync(key);
        if (cached.HasValue) return JsonSerializer.Deserialize<Product>(cached!);

        var product = await _repository.GetAsync(id);
        if (product is not null)
        {
            // jitter, so keys populated together do not expire together
            var ttl = TimeSpan.FromMinutes(10)
                + TimeSpan.FromSeconds(Random.Shared.Next(0, 120));
            await _cache.StringSetAsync(key,
                JsonSerializer.Serialize(product), ttl);
        }
        return product;
    }
    finally
    {
        _lock.Release();
    }
}
```

Two techniques, both worth having: a lock so only one caller refreshes, and jitter on the expiry so keys populated at the same time do not expire at the same time.

`HybridCache` in .NET 9 and later does both, plus an in process layer in front of Redis, and is worth using instead of writing this by hand.

## Invalidation

```csharp
public async Task UpdateProductAsync(Product product)
{
    await _repository.UpdateAsync(product);
    await _cache.KeyDeleteAsync($"product:{product.Id}");
    await _cache.KeyDeleteAsync("products:featured");
}
```

Delete rather than update. Updating the cache means a window where the database write succeeded and the cache write did not, and the two disagree indefinitely.

Deleting means the next read repopulates from the source of truth. A brief miss is much better than lasting inconsistency.

## Never use KEYS

```csharp
// NEVER in production: blocks the server while it scans every key
// var keys = server.Keys(pattern: "product:*");

// scan iterates in batches without blocking
foreach (var key in server.Keys(pattern: "product:*", pageSize: 250))
{
    await _cache.KeyDeleteAsync(key);
}
```

Redis is single threaded. `KEYS` on a large database blocks every other operation until it finishes, which on a big cache means seconds of total unavailability.

The same applies to `FLUSHALL` and to very large `MGET` calls. Anything O(n) over the whole keyspace is dangerous on a busy instance.

## Memory policy

```bash
az redis update --name redis-shop --resource-group rg-shop-prod-uks \
  --set "redisConfiguration.maxmemory-policy=allkeys-lru"
```

```text
volatile-lru   evict least recently used, only keys WITH an expiry. Default.
allkeys-lru    evict least recently used, any key. Right for a pure cache.
noeviction     return errors when full. Right when Redis holds session state.
```

The default `volatile-lru` cannot evict keys with no expiry, so an instance full of keys without expiry starts rejecting writes. That combination causes real outages, and setting an expiry on everything avoids it.

## Premium features

```bash
az redis create --name redis-shop --resource-group rg-shop-prod-uks \
  --sku Premium --vm-size P1 --shard-count 3 \
  --redis-configuration '{"maxmemory-policy":"allkeys-lru"}' \
  --zones 1 2 3
```

```text
Clustering        shard across nodes for more memory and throughput
Persistence       RDB snapshots or AOF, so a restart does not lose everything
Vnet injection    no public endpoint at all
Zone redundancy   survives a zone failure
Geo replication   a linked secondary in another region
```

Clustering changes behaviour: multi key operations only work when the keys are in the same slot, which needs hash tags like `{customer:42}:orders`.

## Monitoring

```bash
az monitor metrics list \
  --resource /subscriptions/.../Redis/redis-shop \
  --metric cachehits cachemisses usedmemorypercentage serverLoad connectedclients evictedkeys \
  --interval PT5M --output table
```

```text
Hit ratio below 80 percent   the cache is not earning its cost
usedmemorypercentage high    approaching eviction
serverLoad above 80          Redis itself is the bottleneck
evictedkeys rising           keys are being pushed out early
connectedclients climbing    probably a multiplexer per request
```

A rising connected client count with no traffic increase is the signature of the shared connection mistake.

## Quick recap

- Basic tier has no replication, so a restart loses everything and it is not for production.
- Always set an expiry, or the cache becomes a second database that fills up.
- Share one `ConnectionMultiplexer`, since creating one per request is the most common Redis mistake.
- Guard against stampedes with a lock and jitter, or use `HybridCache`.
- Invalidate by deleting, not updating, so a failed write cannot leave lasting inconsistency.
- Never run `KEYS` in production, because Redis is single threaded and it blocks everything.
- The default eviction policy cannot evict keys without expiry, which causes write failures.

<code id="code-content" class="language-csharp">
// TIERS: Basic has NO REPLICATION, so a node restart loses everything and
// the cache is unavailable. Fine for development, not for production.
// Standard is two nodes with a 99.9% SLA. Premium adds clustering,
// persistence, vnet injection, zone redundancy and geo replication.
//
// THE MOST COMMON MISTAKE IN .NET, AND A ONE LINE FIX. ConnectionMultiplexer
// is expensive and DESIGNED TO BE SHARED. One per request exhausts
// connections and produces timeouts that look like Redis being slow.
builder.Services.AddSingleton&lt;IConnectionMultiplexer&gt;(sp =&gt;
{
    var options = ConfigurationOptions.Parse(connectionString);
    options.AbortOnConnectFail = false;  // start even if Redis is briefly down
    options.ConnectRetry = 3;
    return ConnectionMultiplexer.Connect(options);
});
//
// CACHE ASIDE. ALWAYS SET AN EXPIRY: a cache without one is a second
// database with no backup and no consistency guarantee, and it fills up.
public async Task&lt;Product?&gt; GetProductAsync(int id)
{
    var key = $"product:{id}";
    var cached = await _cache.StringGetAsync(key);
    if (cached.HasValue) return JsonSerializer.Deserialize&lt;Product&gt;(cached!);
//
    // CACHE STAMPEDE: when a popular key expires EVERY request misses at
    // once, and the cache that was protecting the database now amplifies
    // load onto it. A lock means only one caller refreshes.
    await _lock.WaitAsync();
    try
    {
        cached = await _cache.StringGetAsync(key);   // re-check after waiting
        if (cached.HasValue) return JsonSerializer.Deserialize&lt;Product&gt;(cached!);
//
        var product = await _repository.GetAsync(id);
        // JITTER, so keys populated together do not EXPIRE together:
        var ttl = TimeSpan.FromMinutes(10)
                + TimeSpan.FromSeconds(Random.Shared.Next(0, 120));
        await _cache.StringSetAsync(key, JsonSerializer.Serialize(product), ttl);
        return product;
    }
    finally { _lock.Release(); }
}
// HybridCache in .NET 9+ does both of those, plus an in process layer in
// front of Redis. Prefer it to writing this by hand.
//
// INVALIDATE BY DELETING, NOT UPDATING. Updating leaves a window where the
// database write succeeded and the cache write did not, and they then
// disagree indefinitely. A brief miss beats lasting inconsistency.
await _repository.UpdateAsync(product);
await _cache.KeyDeleteAsync($"product:{product.Id}");
//
// NEVER RUN KEYS IN PRODUCTION. Redis is SINGLE THREADED, so KEYS on a
// large database blocks EVERY other operation until it finishes. Use SCAN:
foreach (var key in server.Keys(pattern: "product:*", pageSize: 250)) { }
//
// EVICTION POLICY. The default volatile-lru CANNOT EVICT KEYS WITH NO
// EXPIRY, so an instance full of them starts REJECTING WRITES. Real
// outages come from this.
//   volatile-lru  default, only keys with an expiry
//   allkeys-lru   right for a pure cache
//   noeviction    right when Redis holds session state
//
// WATCH: hit ratio under 80% means it is not earning its cost. Rising
// connectedclients with no traffic increase is the shared connection bug.
</code></pre>
