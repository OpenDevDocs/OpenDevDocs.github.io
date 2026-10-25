---
publishDate: 2026-06-28T13:35
title: Nx Monorepos and Library Architecture
slug: nx-monorepos-and-libraries
metadescription: Structure a large Angular workspace with libraries, enforce boundaries between them, and use Nx to keep builds fast.
updateDate: 2026-09-07T13:35
author: ['bishal-biswas']
level: 4
tags: ['nx', 'monorepo', 'architecture']
course: angular
---

## Libraries before tools

You do not need Nx to split an application into libraries. The Angular CLI supports it.

```bash
ng generate library shared-ui
ng generate library data-access
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@myorg/shared-ui": ["projects/shared-ui/src/public-api.ts"],
      "@myorg/data-access": ["projects/data-access/src/public-api.ts"]
    }
  }
}
```

```typescript
import { Button } from '@myorg/shared-ui';
```

The value is not just reuse. A library has an **explicit public API**, so what other code can reach is a deliberate choice rather than whatever happens to be exported.

```typescript
// projects/shared-ui/src/public-api.ts
export * from './lib/button/button';
export * from './lib/card/card';
// internal helpers are simply not exported
```

## Where Nx helps

Nx adds what the CLI does not have for a large workspace.

**A dependency graph.** Nx knows which projects depend on which, so it can work out what a change affects.

**Affected commands.** Only build and test what a change touched.

```bash
nx affected -t build
nx affected -t test
nx affected -t lint
```

On a workspace with thirty libraries, a change to one library tests that library and its dependents rather than everything. The difference in continuous integration time is large.

**Computation caching.** A task with unchanged inputs is replayed from cache rather than rerun. With remote caching, a colleague's build result is reused by yours.

**Module boundary rules.** A lint rule that fails the build when a library imports something it should not.

**Generators.** Consistent scaffolding for libraries and components across a team.

## Setting it up

```bash
npx nx@latest init
```

That works on an existing Angular CLI workspace and is incremental. It adds the graph and caching without restructuring your code.

For a new workspace:

```bash
npx create-nx-workspace@latest myorg --preset=angular-monorepo
```

## Categorising libraries

The convention that makes a large workspace navigable is tagging libraries by type and scope.

```text
feature    smart components, routed, knows about the domain
ui         presentational components, no data access
data-access services, state, HTTP
util       pure functions, no framework dependency
```

```text
scope:orders    belongs to the orders domain
scope:billing   belongs to billing
scope:shared    usable anywhere
```

```json
// project.json for a library
{
  "tags": ["type:ui", "scope:shared"]
}
```

## Enforcing boundaries

```json
{
  "@nx/enforce-module-boundaries": [
    "error",
    {
      "depConstraints": [
        {
          "sourceTag": "type:feature",
          "onlyDependOnLibsWithTags": ["type:ui", "type:data-access", "type:util"]
        },
        {
          "sourceTag": "type:ui",
          "onlyDependOnLibsWithTags": ["type:ui", "type:util"]
        },
        {
          "sourceTag": "type:util",
          "onlyDependOnLibsWithTags": ["type:util"]
        },
        {
          "sourceTag": "scope:orders",
          "onlyDependOnLibsWithTags": ["scope:orders", "scope:shared"]
        }
      ]
    }
  ]
}
```

Now a UI library importing an HTTP service is a lint error, and the orders feature importing from billing is a lint error.

**This is the single most valuable thing Nx provides.** Architectural rules that are only written in a document get broken quietly. Rules enforced by the linter do not.

The direction of dependencies matters more than the number of libraries. A workspace with clear layers stays maintainable. One where anything can import anything becomes a tangle regardless of how it is split up.

## A workable structure

```text
apps/
├── portal/
├── admin/
└── portal-e2e/

libs/
├── shared/
│   ├── ui/              buttons, cards, dialogs
│   ├── util-formatting/ pure functions
│   └── data-access-auth/
├── orders/
│   ├── feature-list/
│   ├── feature-detail/
│   ├── ui/
│   └── data-access/
└── billing/
    ├── feature-invoices/
    └── data-access/
```

Applications are thin: routing, layout and configuration. Everything else lives in libraries.

That thinness is the goal. It means a second application can reuse most of the first, and it forces you to think about what belongs where.

## Caching

```json
{
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    },
    "test": {
      "cache": true,
      "inputs": ["default", "^production", "{workspaceRoot}/vitest.config.ts"]
    }
  }
}
```

`dependsOn: ["^build"]` means a project's dependencies build first. `inputs` decides what invalidates the cache, so listing the right files matters. Too few and you get stale results, too many and the cache never hits.

Remote caching shares results across the team and continuous integration. It is the difference between a ten minute pipeline and a one minute one on a large workspace.

## Should you use Nx?

**Yes when:** several applications share code, the workspace has more than roughly ten libraries, several teams work in one repository, or continuous integration is slow because everything rebuilds.

**No when:** it is one application with a handful of libraries. The Angular CLI handles that, and Nx adds configuration you have to maintain.

The honest position: Nx solves problems of scale. Adding it to a small project is overhead without benefit. Adding it to a large one, late, is a migration nobody enjoys.

If a workspace is heading towards several applications, adopting it early is cheaper than adopting it later.

## Publishing a library

```bash
ng build shared-ui
cd dist/shared-ui
npm publish
```

Angular libraries build to the Angular Package Format, which produces the entry points and metadata consumers expect.

For an internal library, `peerDependencies` matter:

```json
{
  "peerDependencies": {
    "@angular/core": "^22.0.0",
    "@angular/common": "^22.0.0"
  }
}
```

Listing Angular as a `dependency` rather than a `peerDependency` gives consumers a second copy of Angular, which breaks dependency injection in ways that are very hard to diagnose.

## Quick recap

- Libraries with an explicit public API are valuable even without Nx.
- Nx adds a dependency graph, affected commands, caching and boundary rules.
- Tag libraries by type and scope, then enforce which may depend on which.
- Enforced boundaries are the highest value feature, because documented rules get broken.
- Keep applications thin and put everything else in libraries.
- `nx affected` and caching are what make a large workspace's pipeline fast.
- Angular must be a `peerDependency` in a published library, never a dependency.

<code id="code-content" class="language-bash">
# Libraries work in a plain Angular CLI workspace. The value is an
# EXPLICIT public API: what other code can reach is a deliberate choice.
ng generate library shared-ui
# tsconfig paths:
#   "@myorg/shared-ui": ["projects/shared-ui/src/public-api.ts"]
# public-api.ts exports only what is meant to be public. Internal
# helpers are simply not exported.
# Nx adds what the CLI does not have at scale. It works INCREMENTALLY
# on an existing workspace.
npx nx@latest init
# Only build and test what a change actually affects. On a workspace with
# thirty libraries this is the difference between a 10 minute pipeline
# and a 1 minute one.
nx affected -t build
nx affected -t test
nx graph                     # see the dependency graph
# TAG libraries by type and scope, in project.json:
#   "tags": ["type:ui", "scope:shared"]
#     type:feature      smart, routed, knows the domain
#     type:ui           presentational, NO data access
#     type:data-access  services, state, HTTP
#     type:util         pure functions, no framework
# Then ENFORCE which may depend on which. This is the highest value thing
# Nx provides: architectural rules written only in a document get broken
# quietly, rules enforced by the linter do not.
#   "@nx/enforce-module-boundaries": ["error", { "depConstraints": [
#     { "sourceTag": "type:feature",
#       "onlyDependOnLibsWithTags": ["type:ui","type:data-access","type:util"] },
#     { "sourceTag": "type:ui",
#       "onlyDependOnLibsWithTags": ["type:ui","type:util"] },
#     { "sourceTag": "scope:orders",
#       "onlyDependOnLibsWithTags": ["scope:orders","scope:shared"] }
#   ]}]
# A workable layout. Applications stay THIN: routing, layout, config.
#   apps/portal  apps/admin
#   libs/shared/ui  libs/shared/util-formatting  libs/shared/data-access-auth
#   libs/orders/feature-list  libs/orders/ui  libs/orders/data-access
#   libs/billing/feature-invoices
# Caching. `inputs` decides what invalidates it: too few gives stale
# results, too many and it never hits.
#   "targetDefaults": {
#     "build": { "cache": true, "dependsOn": ["^build"] }
#   }
# USE NX when several apps share code, there are 10+ libraries, or CI is
# slow because everything rebuilds. For one app with a few libraries the
# CLI is enough and Nx is configuration you must maintain.
# Publishing: Angular MUST be a peerDependency. Listing it as a dependency
# gives consumers a second copy and breaks dependency injection in ways
# that are very hard to diagnose.
ng build shared-ui &amp;&amp; cd dist/shared-ui &amp;&amp; npm publish
</code></pre>
