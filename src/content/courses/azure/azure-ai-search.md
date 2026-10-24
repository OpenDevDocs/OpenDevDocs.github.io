---
publishDate: 2026-10-29T13:25
title: Azure AI Search
slug: azure-ai-search
metadescription: Build search over your own content with Azure AI Search, combining keyword, vector and semantic ranking.
updateDate: 2026-09-07T13:25
author: ['bishal-biswas']
level: 3
tags: ['ai', 'search', 'retrieval']
course: azure
---

## What it is

A managed search service. You define an index, push or pull documents into it, and query with keyword search, vector similarity, or both.

It is also the retrieval half of most retrieval augmented generation systems, which is why it appears in nearly every Azure AI architecture.

```bash
az search service create \
  --name srch-shop --resource-group rg-shop-ai-uks \
  --sku standard --location uksouth \
  --partition-count 1 --replica-count 2 --identity-type SystemAssigned
```

```text
Free      one index, 50 MB. Learning only.
Basic     small production, no availability SLA below 2 replicas
Standard  most production. S1, S2, S3 by size.
Storage Optimized  large indexes, lower query volume
```

**Replicas give availability and query throughput; partitions give index size and indexing throughput.** Two replicas are the minimum for a read SLA, and three for read and write.

Neither can be changed on the Free or Basic tiers, so start at Standard for anything real.

## Defining an index

```json
{
  "name": "products",
  "fields": [
    { "name": "id", "type": "Edm.String", "key": true, "filterable": true },
    { "name": "name", "type": "Edm.String", "searchable": true, "analyzer": "en.microsoft" },
    { "name": "description", "type": "Edm.String", "searchable": true },
    { "name": "category", "type": "Edm.String", "filterable": true, "facetable": true },
    { "name": "price", "type": "Edm.Double", "filterable": true, "sortable": true },
    { "name": "inStock", "type": "Edm.Boolean", "filterable": true },
    { "name": "tags", "type": "Collection(Edm.String)", "filterable": true, "facetable": true },
    {
      "name": "contentVector",
      "type": "Collection(Edm.Single)",
      "searchable": true,
      "dimensions": 1536,
      "vectorSearchProfile": "default-profile"
    }
  ],
  "vectorSearch": {
    "algorithms": [
      { "name": "hnsw-config", "kind": "hnsw",
        "hnswParameters": { "m": 4, "efConstruction": 400, "metric": "cosine" } }
    ],
    "profiles": [
      { "name": "default-profile", "algorithm": "hnsw-config" }
    ]
  },
  "semantic": {
    "configurations": [
      {
        "name": "default-semantic",
        "prioritizedFields": {
          "titleField": { "fieldName": "name" },
          "prioritizedContentFields": [ { "fieldName": "description" } ]
        }
      }
    ]
  }
}
```

Every field attribute costs something.

```text
searchable   full text indexed. Storage and indexing cost.
filterable   usable in $filter. Adds an index.
sortable     usable in $orderby.
facetable    usable for facet counts.
retrievable  returned in results. Turn OFF for large fields you never display.
```

Marking everything searchable and filterable is the default mistake. It inflates index size and slows indexing, and most fields need only one attribute.

**The schema is largely immutable.** Adding a field is fine; changing a type or an analyzer means rebuilding the index. Design it deliberately.

## Three kinds of search

```text
Keyword   BM25 term matching. Exact terms, product codes, names.
Vector    embedding similarity. Meaning, synonyms, paraphrase.
Hybrid    both, fused. Almost always the best result.
Semantic  a reranker applied on top, using a language model.
```

```csharp
var results = await searchClient.SearchAsync<Product>(
    searchText: "waterproof walking boots",
    new SearchOptions
    {
        VectorSearch = new()
        {
            Queries =
            {
                new VectorizedQuery(embedding)
                {
                    KNearestNeighborsCount = 50,
                    Fields = { "contentVector" }
                }
            }
        },
        QueryType = SearchQueryType.Semantic,
        SemanticSearch = new()
        {
            SemanticConfigurationName = "default-semantic",
            QueryCaption = new(QueryCaptionType.Extractive)
        },
        Filter = "inStock eq true and price le 150",
        Facets = { "category", "tags" },
        Size = 10
    });
```

**Hybrid with semantic ranking is the configuration that performs best** in practice. Keyword alone misses paraphrase; vector alone misses exact product codes; together they cover both, and the reranker fixes the ordering.

Note the filter. Filters are applied as a hard constraint, so an out of stock product cannot appear regardless of relevance.

## Integrated vectorisation

```json
{
  "vectorSearch": {
    "vectorizers": [
      {
        "name": "openai-vectorizer",
        "kind": "azureOpenAI",
        "azureOpenAIParameters": {
          "resourceUri": "https://aoai-shop.openai.azure.com",
          "deploymentId": "text-embedding-3-small",
          "modelName": "text-embedding-3-small",
          "authIdentity": null
        }
      }
    ],
    "profiles": [
      { "name": "default-profile", "algorithm": "hnsw-config", "vectorizer": "openai-vectorizer" }
    ]
  }
}
```

With a vectorizer configured, the service embeds documents at indexing time and queries at search time. Your code sends text, not vectors.

```csharp
Queries = { new VectorizableTextQuery("waterproof walking boots")
    { KNearestNeighborsCount = 50, Fields = { "contentVector" } } }
```

That removes the embedding step from the application entirely, and keeps the query and document embeddings using the same model, which matters because mixing models produces meaningless similarity.

## Indexers

```bash
az search indexer create --service-name srch-shop --resource-group rg-shop-ai-uks \
  --name products-indexer --body @indexer.json
```

```json
{
  "name": "products-indexer",
  "dataSourceName": "products-sql",
  "targetIndexName": "products",
  "schedule": { "interval": "PT1H" },
  "parameters": {
    "batchSize": 500,
    "maxFailedItems": 10,
    "configuration": { "dataToExtract": "contentAndMetadata" }
  },
  "fieldMappings": [
    { "sourceFieldName": "ProductId", "targetFieldName": "id" }
  ],
  "outputFieldMappings": [
    { "sourceFieldName": "/document/pages/*/vector", "targetFieldName": "contentVector" }
  ]
}
```

An indexer pulls from a data source on a schedule: Azure SQL, Cosmos DB, Blob Storage, Data Lake. Change tracking means only new and modified rows are processed.

A skillset attached to an indexer can chunk documents, extract text from PDFs, run OCR, detect language and generate embeddings, all during indexing.

**Chunking matters more than most settings.** A whole document embedded as one vector retrieves poorly; chunks of a few hundred tokens with some overlap retrieve well.

## Pushing documents instead

```csharp
var batch = IndexDocumentsBatch.MergeOrUpload(products);
IndexDocumentsResult result = await searchClient.IndexDocumentsAsync(batch,
    new IndexDocumentsOptions { ThrowOnAnyError = false });

foreach (var failed in result.Results.Where(r => !r.Succeeded))
{
    _logger.LogError("Failed to index {Key}: {Message}", failed.Key, failed.ErrorMessage);
}
```

Pushing gives immediate control over timing, which matters when the index must reflect a change straight away. Indexers are simpler and run on a schedule.

`MergeOrUpload` updates existing documents and creates missing ones, which is usually what you want. Batch in groups of a few hundred rather than one at a time.

## Security

```bash
az search service update --name srch-shop --resource-group rg-shop-ai-uks \
  --auth-options aadOrApiKey --aad-auth-failure-mode http401WithBearerChallenge

az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Search Index Data Reader" \
  --scope /subscriptions/.../searchServices/srch-shop
```

```text
Search Service Contributor    manage indexes
Search Index Data Contributor read and write documents
Search Index Data Reader      query only
```

For multi tenant content, filter by a security field on every query:

```csharp
Filter = $"tenantId eq '{tenantId}' and groupIds/any(g: search.in(g, '{userGroups}'))"
```

**Trimming results by permission must happen in the filter**, not after retrieval. Filtering afterwards means the ranking and the result count are wrong, and it leaks the existence of documents through facet counts.

## Tuning relevance

```json
{
  "scoringProfiles": [
    {
      "name": "boost-recent-and-popular",
      "text": { "weights": { "name": 3.0, "description": 1.0 } },
      "functions": [
        { "type": "freshness", "fieldName": "publishedDate", "boost": 2,
          "interpolation": "quadratic", "freshness": { "boostingDuration": "P30D" } },
        { "type": "magnitude", "fieldName": "salesCount", "boost": 1.5,
          "interpolation": "logarithmic",
          "magnitude": { "boostingRangeStart": 0, "boostingRangeEnd": 1000 } }
    ]
    }
  ]
}
```

A scoring profile boosts by field weight, freshness, popularity, distance or a tag match. It is how "relevant" becomes "relevant for this business".

Measure before and after. Relevance tuning without a test set of queries and expected results is guesswork, and it usually makes things worse in a way nobody notices.

## Quick recap

- Replicas give availability and query throughput; partitions give size and indexing throughput.
- Every field attribute costs, so do not mark everything searchable and filterable.
- The schema is largely immutable, and changing a type means rebuilding.
- Hybrid search with semantic ranking performs best, since keyword and vector cover different gaps.
- Integrated vectorisation removes embedding from your code and keeps models consistent.
- Chunking affects retrieval quality more than most settings.
- Apply permission trimming in the filter, or ranking and facet counts leak and mislead.

<code id="code-content" class="language-csharp">
// REPLICAS give availability and QUERY throughput. PARTITIONS give index
// size and INDEXING throughput. Two replicas minimum for a read SLA, three
// for read and write. Neither is changeable on Free or Basic.
//
// EVERY FIELD ATTRIBUTE COSTS SOMETHING, and marking everything searchable
// and filterable is the default mistake:
//   searchable   full text indexed        filterable  usable in $filter
//   sortable     usable in $orderby       facetable   facet counts
//   retrievable  returned in results. TURN OFF for large unused fields.
// THE SCHEMA IS LARGELY IMMUTABLE: adding a field is fine, changing a TYPE
// or ANALYZER means REBUILDING the index.
//
// THREE KINDS, AND HYBRID WITH SEMANTIC RANKING PERFORMS BEST:
//   KEYWORD  BM25. Exact terms, product codes.   Misses paraphrase.
//   VECTOR   embedding similarity, meaning.      Misses exact codes.
//   HYBRID   both, fused.                        Covers both gaps.
//   SEMANTIC a language model RERANKER on top, fixing the ordering.
var results = await searchClient.SearchAsync&lt;Product&gt;(
    searchText: "waterproof walking boots",
    new SearchOptions
    {
        VectorSearch = new()
        {
            // With INTEGRATED VECTORISATION the service embeds the query
            // for you, so your code sends TEXT, not vectors. It also keeps
            // query and document embeddings on the SAME MODEL, and mixing
            // models produces meaningless similarity.
            Queries = { new VectorizableTextQuery("waterproof walking boots")
                { KNearestNeighborsCount = 50, Fields = { "contentVector" } } }
        },
        QueryType = SearchQueryType.Semantic,
        SemanticSearch = new() { SemanticConfigurationName = "default-semantic" },
        // Filters are a HARD CONSTRAINT: out of stock cannot appear
        // whatever its relevance.
        Filter = "inStock eq true and price le 150",
        Facets = { "category", "tags" },
        Size = 10
    });
//
// INDEXERS pull from SQL, Cosmos, Blob or Data Lake on a schedule, with
// change tracking so only new and modified rows are processed. A SKILLSET
// can chunk, OCR, extract and embed during indexing.
// CHUNKING MATTERS MORE THAN MOST SETTINGS: a whole document as one vector
// retrieves poorly; a few hundred tokens with overlap retrieves well.
//
// PUSHING gives immediate control when the index must reflect a change
// straight away. Batch in hundreds, not one at a time.
var batch = IndexDocumentsBatch.MergeOrUpload(products);   // updates or creates
var result = await searchClient.IndexDocumentsAsync(batch,
    new IndexDocumentsOptions { ThrowOnAnyError = false });
foreach (var failed in result.Results.Where(r =&gt; !r.Succeeded))
    _logger.LogError("Failed {Key}: {Message}", failed.Key, failed.ErrorMessage);
//
// PERMISSION TRIMMING MUST HAPPEN IN THE FILTER, not after retrieval.
// Filtering afterwards makes the ranking and result count wrong, and LEAKS
// THE EXISTENCE OF DOCUMENTS through facet counts.
Filter = $"tenantId eq '{tenantId}' and groupIds/any(g: search.in(g, '{userGroups}'))";
//
// SCORING PROFILES boost by field weight, freshness, popularity or
// distance. That is how "relevant" becomes "relevant FOR THIS BUSINESS".
// MEASURE BEFORE AND AFTER: relevance tuning without a test set of queries
// and expected results usually makes things worse in a way nobody notices.
</code></pre>
