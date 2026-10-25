---
title: Geospatial Indexes and Queries
slug: geospatial-indexes
metadescription: Learn how to store locations as GeoJSON in MongoDB, create a 2dsphere index, and find nearby places with $near, $geoWithin and $geoNear.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'geospatial', 'indexes', 'geojson']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- How to store a location in MongoDB using **GeoJSON**
- Why **longitude comes first** (the most common beginner bug)
- How to create a **2dsphere** index
- How to find nearby places with `$near`, places inside an area with `$geoWithin`, and distances with `$geoNear`

> **Before you start:** this lesson assumes you've read [Single Field and Compound Indexes](/courses/mongodb/indexes-single-and-compound) and [Embedded Documents and Dot Notation](/courses/mongodb/embedded-documents).

## Why location queries need special help

Food delivery, ride booking, "stores near me", property search: lots of apps ask questions like:

- Which of our stores are within 3 km of this customer?
- What is the **closest** pickup point?
- Which deliveries fall inside this city zone?

You can't answer these with normal `$lt` and `$gt` comparisons. The Earth is round, and distance depends on both latitude and longitude together. MongoDB has **geospatial** queries and indexes built for exactly this.

> **Think of it like this:** A normal index is like an alphabetical list of street names. A geospatial index is like a map divided into a grid of squares. To find cafes near you, you only look in your square and the squares around it, instead of checking every cafe in the country.

## Storing a location with GeoJSON

MongoDB uses **GeoJSON**, a standard format for map data. A single location is a **Point**:

```javascript
{ type: "Point", coordinates: [ 88.3426, 22.5448 ] }
//                              longitude  latitude
```

> **Warning:** In GeoJSON the order is **[longitude, latitude]**, which is the *opposite* of how Google Maps shows coordinates (latitude, longitude). Swapping them is the number one geospatial mistake. Valid longitude is -180 to 180, and valid latitude is -90 to 90.

Let's add some pickup points for our shop in Kolkata to a new `stores` collection:

```javascript
use shop

db.stores.insertMany([
  { name: "Victoria Memorial Store", city: "Kolkata", type: "pickup",
    location: { type: "Point", coordinates: [88.3426, 22.5448] } },
  { name: "Park Street Store", city: "Kolkata", type: "full",
    location: { type: "Point", coordinates: [88.3520, 22.5530] } },
  { name: "Eden Gardens Store", city: "Kolkata", type: "pickup",
    location: { type: "Point", coordinates: [88.3433, 22.5646] } },
  { name: "Howrah Bridge Store", city: "Kolkata", type: "full",
    location: { type: "Point", coordinates: [88.3468, 22.5851] } },
  { name: "Salt Lake Store", city: "Kolkata", type: "full",
    location: { type: "Point", coordinates: [88.4135, 22.5868] } }
])
```

GeoJSON also has other shapes like **LineString** (a road) and **Polygon** (an area). We'll use a Polygon later.

## Creating a 2dsphere index

A **2dsphere** index understands that the Earth is a sphere and calculates real distances in metres.

```javascript
db.stores.createIndex({ location: "2dsphere" })
// → location_2dsphere
```

Once the index exists, MongoDB checks every new location. A bad one is rejected:

```javascript
db.stores.insertOne({ name: "Oops Store", location: { type: "Point", coordinates: [22.5448, 188.3426] } })
// → MongoServerError: Can't extract geo keys ... longitude/latitude is out of bounds
```

You can also combine a 2dsphere field with normal fields in a compound index, for example:

```javascript
// An alternative to the single-field index above (don't create both in this lesson)
db.stores.createIndex({ type: 1, location: "2dsphere" })
```

> **Tip:** Keep just **one** geospatial index per collection while you learn. When a collection has several, the `$geoNear` stage (later in this lesson) can't pick one by itself and you must tell it which field to use with its `key` option.

> **Note:** MongoDB also has an older **2d** index for flat, x/y coordinates (like positions on a game board). For real places on Earth, always use **2dsphere**.

## Finding nearby places with $near

A customer is standing at `[88.3480, 22.5500]`. Let's find stores within 2 km, closest first:

```javascript
db.stores.find(
  {
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [88.3480, 22.5500] },
        $maxDistance: 2000   // metres
      }
    }
  },
  { name: 1, _id: 0 }
)
// → [
//   { name: 'Park Street Store' },        (about 530 m away)
//   { name: 'Victoria Memorial Store' },  (about 800 m away)
//   { name: 'Eden Gardens Store' }        (about 1.7 km away)
// ]
```

Key points about `$near`:

- Results come back **sorted from nearest to farthest** automatically.
- `$maxDistance` and `$minDistance` are in **metres** when you use a GeoJSON point.
- `$near` **requires** a geospatial index. Without one you get an error.

You can mix `$near` with normal filters. Here are the closest **full** stores only:

```javascript
db.stores.find({
  type: "full",
  location: { $near: { $geometry: { type: "Point", coordinates: [88.3480, 22.5500] } } }
}).limit(1)
// → [ { name: 'Park Street Store', ... } ]
```

## Finding places inside an area with $geoWithin

`$geoWithin` finds documents **inside** a shape. It doesn't sort by distance.

### Inside a circle

Use `$centerSphere` with a centre and a radius in **radians**. To convert kilometres to radians, divide by the Earth's radius, about **6378.1 km**:

```javascript
db.stores.find({
  location: {
    $geoWithin: {
      $centerSphere: [ [88.3480, 22.5500], 5 / 6378.1 ]   // 5 km radius
    }
  }
}, { name: 1, _id: 0 })
// → Park Street, Victoria Memorial, Eden Gardens and Howrah Bridge (in no particular order)
```

### Inside a polygon

A **Polygon** is a list of corner points. The first and last points must be the **same**, to close the shape. Here is a rough "central Kolkata" delivery zone:

```javascript
db.stores.find({
  location: {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [[
          [88.33, 22.54],
          [88.36, 22.54],
          [88.36, 22.57],
          [88.33, 22.57],
          [88.33, 22.54]    // same as the first point: shape closed
        ]]
      }
    }
  }
}, { name: 1, _id: 0 })
// → Victoria Memorial Store, Park Street Store, Eden Gardens Store
```

> **Tip:** `$geoWithin` works even without an index, but an index makes it much faster on large collections. Unlike `$near`, you can use `$geoWithin` inside `countDocuments()`.

```javascript
db.stores.countDocuments({
  location: { $geoWithin: { $centerSphere: [ [88.3480, 22.5500], 2 / 6378.1 ] } }
})
// → 3
```

## Getting the distance with $geoNear

`$near` sorts by distance but doesn't tell you **how far** each place is. For that, use the `$geoNear` stage in an aggregation pipeline:

```javascript
db.stores.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [88.3480, 22.5500] },
      distanceField: "distanceMetres",
      maxDistance: 5000,
      query: { type: "full" },   // optional extra filter
      spherical: true
    }
  },
  { $project: { _id: 0, name: 1, distanceMetres: { $round: ["$distanceMetres", 0] } } }
])
// → [
//   { name: 'Park Street Store',   distanceMetres: 530 },
//   { name: 'Howrah Bridge Store', distanceMetres: 3909 }
// ]
```

Rules for `$geoNear`:

- It must be the **first stage** in the pipeline.
- It needs a geospatial index on the collection.
- `distanceField` is the new field that holds the distance (in metres for GeoJSON points).
- Add `distanceMultiplier: 0.001` if you'd rather get kilometres.

> **Note:** You'll learn more about pipelines in [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals). For now, think of `$geoNear` as "a `find` with `$near` that also writes down the distance".

## Does this point lie inside a zone? ($geoIntersects)

Sometimes it's the other way around: you store **zones** and want to know which zone a customer's point falls in. Store each zone as a Polygon and use `$geoIntersects`:

```javascript
db.deliveryZones.createIndex({ area: "2dsphere" })

db.deliveryZones.insertOne({
  name: "Central",
  area: { type: "Polygon", coordinates: [[ [88.33, 22.54], [88.36, 22.54], [88.36, 22.57], [88.33, 22.57], [88.33, 22.54] ]] }
})

db.deliveryZones.find({
  area: { $geoIntersects: { $geometry: { type: "Point", coordinates: [88.3480, 22.5500] } } }
}, { name: 1, _id: 0 })
// → [ { name: 'Central' } ]
```

## Cheat sheet

| Operator | Question it answers | Sorted by distance? | Needs index? |
| --- | --- | --- | --- |
| `$near` | What is close to this point? | Yes | Yes |
| `$geoWithin` | What is inside this circle or polygon? | No | No (but faster with one) |
| `$geoIntersects` | Which shapes touch this point or shape? | No | No (but faster with one) |
| `$geoNear` (stage) | What's close, and how far is each? | Yes | Yes |

## Common mistakes

- **Latitude first.** GeoJSON is `[longitude, latitude]`. If your Kolkata store shows up in the ocean, you swapped them.
- **Mixing units.** `$maxDistance` with GeoJSON is in metres, but `$centerSphere` uses radians. Divide km by 6378.1 for radians.
- **Polygon not closed.** The first and last points of a Polygon ring must be identical, or MongoDB rejects it.
- **Using `$near` with `countDocuments()`.** It isn't allowed. Use `$geoWithin` with `$centerSphere` to count places in a radius.
- **`$geoNear` not first.** It must be the very first stage of the pipeline.

## Practice

1. Add a store called "New Market Store" at longitude 88.3510, latitude 22.5590 with `type: "pickup"`.
2. Find the single closest **pickup** store to a customer at `[88.3600, 22.5700]`.
3. List all stores within 3 km of `[88.3480, 22.5500]` with their distance in kilometres.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1.
db.stores.insertOne({
  name: "New Market Store", city: "Kolkata", type: "pickup",
  location: { type: "Point", coordinates: [88.3510, 22.5590] }
})

// 2.
db.stores.find({
  type: "pickup",
  location: { $near: { $geometry: { type: "Point", coordinates: [88.3600, 22.5700] } } }
}).limit(1)

// 3.
db.stores.aggregate([
  { $geoNear: {
      near: { type: "Point", coordinates: [88.3480, 22.5500] },
      distanceField: "distanceKm",
      maxDistance: 3000,
      distanceMultiplier: 0.001,
      spherical: true
  } },
  { $project: { _id: 0, name: 1, distanceKm: { $round: ["$distanceKm", 2] } } }
])
```

</details>

## Key takeaways

- Store locations as GeoJSON: `{ type: "Point", coordinates: [longitude, latitude] }`.
- Create a **2dsphere** index for real-world locations: `createIndex({ location: "2dsphere" })`.
- `$near` finds nearby documents, sorted by distance, with `$maxDistance` in metres.
- `$geoWithin` finds documents inside a circle (`$centerSphere`, radius in radians) or a polygon.
- `$geoNear` is an aggregation stage that also returns the distance; it must come first.
- `$geoIntersects` tells you which stored shapes contain or touch a point.

**Next lesson:** [explain and Query Plans](/courses/mongodb/explain-and-query-plans)
