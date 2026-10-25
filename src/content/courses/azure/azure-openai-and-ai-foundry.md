---
publishDate: 2026-10-28T13:20
title: Azure OpenAI and AI Foundry
slug: azure-openai-and-ai-foundry
metadescription: Build with Azure OpenAI and AI Foundry, deploy models with the right capacity type, and control cost and grounding.
updateDate: 2026-09-07T13:20
author: ['bishal-biswas']
level: 3
tags: ['ai', 'azure openai', 'foundry']
course: azure
---

## What the services are

```text
Azure OpenAI      OpenAI models hosted in Azure, with your data staying in your tenant
Azure AI Foundry  the platform around them: model catalogue, agents, evaluation,
                  tracing, content safety and deployment
```

Foundry is where the work happens now. It covers OpenAI models alongside Llama, Mistral, Phi and others, with one deployment and evaluation experience.

```bash
az cognitiveservices account create \
  --name aoai-shop --resource-group rg-shop-ai-uks \
  --kind AIServices --sku S0 --location uksouth \
  --custom-domain aoai-shop \
  --assign-identity

az cognitiveservices account deployment create \
  --name aoai-shop --resource-group rg-shop-ai-uks \
  --deployment-name gpt-4o-mini \
  --model-name gpt-4o-mini --model-version "2024-07-18" \
  --model-format OpenAI \
  --sku-name GlobalStandard --sku-capacity 100
```

A **custom domain** is required for Entra ID authentication, so set it at creation.

## Capacity types

This is the decision that affects both cost and reliability.

```text
Standard          pay per token, regional. Shared capacity, so throttling happens.
Global Standard   pay per token, routed globally. Better availability, lower cost.
Data Zone         pay per token, within a data residency boundary.
Provisioned (PTU) reserved throughput. Predictable latency, no throttling, expensive.
Batch             asynchronous, roughly half price, up to 24 hour turnaround.
```

```text
Prototyping and low volume   Global Standard
Production with steady load  Provisioned, if the volume justifies it
Bulk processing, not urgent  Batch, at half the cost
Data residency requirement   Data Zone or regional Standard
```

**Provisioned throughput is expensive and has a minimum.** It is right when consistent latency matters and volume is high enough, and wrong for anything intermittent.

## Authenticate without a key

```csharp
var client = new AzureOpenAIClient(
    new Uri("https://aoai-shop.openai.azure.com/"),
    new DefaultAzureCredential());

var chat = client.GetChatClient("gpt-4o-mini");

var completion = await chat.CompleteChatAsync(
[
    new SystemChatMessage("You are a concise assistant for a UK online shop. Answer in British English."),
    new UserChatMessage(question)
],
new ChatCompletionOptions
{
    Temperature = 0.2f,
    MaxOutputTokenCount = 800
});

Console.WriteLine(completion.Value.Content[0].Text);
```

```bash
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Cognitive Services OpenAI User" \
  --scope /subscriptions/.../accounts/aoai-shop
```

API keys work and should be avoided for the same reasons as everywhere else. Entra ID gives per identity access, an audit trail and revocation.

## Streaming

```csharp
await foreach (StreamingChatCompletionUpdate update in
    chat.CompleteChatStreamingAsync(messages, options))
{
    foreach (var part in update.ContentUpdate)
    {
        await response.WriteAsync(part.Text);
        await response.Body.FlushAsync();
    }
}
```

Streaming changes the perceived speed considerably. A response taking eight seconds feels acceptable when text appears immediately and unacceptable when nothing happens for eight seconds.

For anything user facing, stream.

## Structured output

```csharp
var options = new ChatCompletionOptions
{
    ResponseFormat = ChatResponseFormat.CreateJsonSchemaFormat(
        jsonSchemaFormatName: "order_extraction",
        jsonSchema: BinaryData.FromString("""
        {
          "type": "object",
          "properties": {
            "customerName": { "type": "string" },
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "sku": { "type": "string" },
                  "quantity": { "type": "integer" }
                },
                "required": ["sku", "quantity"],
                "additionalProperties": false
              }
            }
          },
          "required": ["customerName", "items"],
          "additionalProperties": false
        }
        """),
        jsonSchemaIsStrict: true)
};
```

Structured output with a strict schema guarantees valid JSON matching the shape. That removes the parsing and retry code that otherwise surrounds every call.

Use it whenever the output feeds code rather than a person.

## Grounding with your own data

The pattern that makes these models useful for a business: retrieve relevant content, then ask the model to answer from it.

```csharp
// 1. embed the question
var embeddingClient = client.GetEmbeddingClient("text-embedding-3-small");
var embedding = await embeddingClient.GenerateEmbeddingAsync(question);

// 2. search your own content
var results = await searchClient.SearchAsync<Document>(
    question,
    new SearchOptions
    {
        VectorSearch = new()
        {
            Queries = { new VectorizedQuery(embedding.Value.ToFloats())
                { KNearestNeighborsCount = 5, Fields = { "contentVector" } } }
        },
        QueryType = SearchQueryType.Semantic,
        Size = 5
    });

// 3. answer from the retrieved content only
var context = string.Join("\n\n", results.Value.GetResults().Select(r => r.Document.Content));

var grounded = await chat.CompleteChatAsync(
[
    new SystemChatMessage(
        "Answer using ONLY the provided context. If the context does not " +
        "contain the answer, say you do not know. Cite the source of each claim."),
    new UserChatMessage($"Context:\n{context}\n\nQuestion: {question}")
]);
```

**Instruct it to say it does not know.** Without that, a model asked a question its context does not cover will produce a plausible answer anyway, and a confident wrong answer is worse than no answer.

## Content safety

```bash
az cognitiveservices account deployment create \
  --name aoai-shop --resource-group rg-shop-ai-uks \
  --deployment-name gpt-4o-mini --model-name gpt-4o-mini \
  --model-version "2024-07-18" --model-format OpenAI \
  --sku-name GlobalStandard --sku-capacity 100
```

Content filtering is on by default, at a configurable severity, covering hate, violence, sexual content and self harm on both input and output.

Prompt shields additionally detect jailbreak attempts and indirect injection from retrieved documents, which matters when the model reads content you did not write.

That last case is worth thinking about: a retrieved document containing instructions is an injection vector, and treating retrieved content as data rather than instruction is the defence.

## Managing cost

```csharp
_logger.LogInformation(
    "Chat completed: {InputTokens} in, {OutputTokens} out, model {Model}",
    completion.Value.Usage.InputTokenCount,
    completion.Value.Usage.OutputTokenCount,
    "gpt-4o-mini");
```

```text
Choose the smallest model that works. gpt-4o-mini is a fraction of gpt-4o.
Cap max output tokens. An unbounded response is an unbounded cost.
Trim conversation history rather than resending everything.
Cache responses to repeated questions.
Use Batch for anything not urgent, at roughly half price.
Measure tokens per request, and alert on unusual increases.
```

The most common cost surprise is a chat application resending the full conversation history on every turn, so cost grows quadratically with conversation length.

## Agents

```text
Foundry Agent Service manages threads, tool calling, file search and
code interpretation, so you do not build the orchestration loop.
```

```csharp
var agent = await agentClient.CreateAgentAsync(
    model: "gpt-4o-mini",
    name: "order-assistant",
    instructions: "Help customers with order queries. Use the tools provided. " +
                  "Never invent an order number.",
    tools: [ new FunctionToolDefinition("lookup_order", "Look up an order by number", parameters) ]);
```

Useful when the model must call several tools across turns. For a single call with a single tool, calling it directly is simpler and easier to debug.

## Evaluation

```text
Groundedness  is the answer supported by the retrieved context
Relevance     does it address the question
Coherence     is it readable
Fluency       is the language correct
Similarity    how close to a reference answer
```

Foundry's evaluation runs these against a test set, so a prompt or model change can be measured rather than judged by feel.

**Build the test set early.** Twenty representative questions with expected answers turns "does this seem better" into a number, and without it every prompt change is a guess.

## Quick recap

- AI Foundry is the platform, and it covers OpenAI models alongside others.
- Set a custom domain at creation, since Entra ID authentication requires it.
- Global Standard for most work, Provisioned for high steady volume, Batch at half price.
- Use Entra ID rather than API keys, and stream anything user facing.
- Structured output with a strict schema removes parsing and retry code.
- Instruct the model to say it does not know, since a confident wrong answer is worse.
- Build an evaluation set early, or every prompt change is a guess.

<code id="code-content" class="language-csharp">
// AI FOUNDRY is the platform: model catalogue, agents, evaluation, tracing,
// content safety. It covers OpenAI models alongside Llama, Mistral and Phi.
// A CUSTOM DOMAIN IS REQUIRED for Entra ID authentication. Set it at creation.
//
// CAPACITY TYPE AFFECTS BOTH COST AND RELIABILITY:
//   Standard          pay per token, regional, SHARED capacity so throttling
//   Global Standard   pay per token, routed globally. Better and cheaper.
//   Provisioned (PTU) reserved throughput, no throttling, EXPENSIVE, has a
//                     minimum. Right for high steady volume only.
//   Batch             asynchronous, ROUGHLY HALF PRICE, up to 24 hours.
//
// ENTRA ID, NOT AN API KEY: per identity access, audit trail, revocation.
var client = new AzureOpenAIClient(
    new Uri("https://aoai-shop.openai.azure.com/"), new DefaultAzureCredential());
var chat = client.GetChatClient("gpt-4o-mini");
//
// STREAM ANYTHING USER FACING. Eight seconds feels acceptable when text
// appears immediately, and unacceptable when nothing happens for eight seconds.
await foreach (var update in chat.CompleteChatStreamingAsync(messages, options))
    foreach (var part in update.ContentUpdate) await response.WriteAsync(part.Text);
//
// STRUCTURED OUTPUT with a STRICT schema GUARANTEES valid JSON of that
// shape, removing the parsing and retry code that otherwise surrounds every
// call. Use it whenever the output feeds CODE rather than a person.
var options = new ChatCompletionOptions
{
    ResponseFormat = ChatResponseFormat.CreateJsonSchemaFormat(
        "order_extraction", BinaryData.FromString(schemaJson), jsonSchemaIsStrict: true),
    Temperature = 0.2f,
    MaxOutputTokenCount = 800     // an unbounded response is an unbounded cost
};
//
// GROUNDING is what makes these models useful for a business: retrieve
// relevant content, then answer FROM IT.
var grounded = await chat.CompleteChatAsync(
[
    // INSTRUCT IT TO SAY IT DOES NOT KNOW. Without this, a model asked
    // something its context does not cover produces a PLAUSIBLE answer
    // anyway, and a confident wrong answer is worse than no answer.
    new SystemChatMessage("Answer using ONLY the provided context. If the " +
        "context does not contain the answer, say you do not know. Cite sources."),
    new UserChatMessage($"Context:\n{context}\n\nQuestion: {question}")
]);
// A RETRIEVED DOCUMENT CONTAINING INSTRUCTIONS IS AN INJECTION VECTOR.
// Prompt shields help; treating retrieved content as DATA is the defence.
//
// MEASURE TOKENS. The most common cost surprise is a chat application
// resending the FULL conversation history every turn, so cost grows
// QUADRATICALLY with conversation length.
_logger.LogInformation("Chat: {In} in, {Out} out",
    completion.Value.Usage.InputTokenCount, completion.Value.Usage.OutputTokenCount);
// Smallest model that works, cap output tokens, trim history, cache repeats,
// and use Batch for anything not urgent.
//
// BUILD THE EVALUATION SET EARLY. Twenty representative questions with
// expected answers turns "does this seem better" into a NUMBER. Without it,
// every prompt change is a guess.
//   groundedness | relevance | coherence | fluency | similarity
</code></pre>
