---
publishDate: 2026-06-28T13:30
title: Custom Build Pipelines with the Angular Build System
slug: custom-build-pipelines
metadescription: Understand the Angular build system, extend it with custom builders, and integrate tools it does not ship with.
updateDate: 2026-09-07T13:30
author: ['bishal-biswas']
level: 4
tags: ['build', 'esbuild', 'tooling']
course: angular
---

## The current build system

Angular moved from webpack to **esbuild** and Vite, and the `@angular/build:application` builder is the default for new projects.

```json
{
  "architect": {
    "build": {
      "builder": "@angular/build:application",
      "options": {
        "browser": "src/main.ts",
        "server": "src/main.server.ts",
        "index": "src/index.html",
        "tsConfig": "tsconfig.app.json",
        "assets": [{ "glob": "**/*", "input": "public" }],
        "styles": ["src/styles.css"],
        "polyfills": []
      }
    }
  }
}
```

Older projects use `@angular-devkit/build-angular:browser`, which is webpack based. Both work. Migrate with:

```bash
ng update @angular/cli --name use-application-builder
```

The new builder is substantially faster and produces a single build output for browser, server and prerendered pages.

## Build options worth knowing

```json
{
  "options": {
    "outputHashing": "all",
    "sourceMap": { "scripts": true, "styles": false, "hidden": true },
    "optimization": {
      "scripts": true,
      "styles": { "minify": true, "inlineCritical": true },
      "fonts": { "inline": true }
    },
    "define": {
      "APP_VERSION": "\"1.4.0\""
    },
    "loader": {
      ".md": "text",
      ".svg": "text"
    },
    "externalDependencies": ["some-cdn-package"]
  }
}
```

**`inlineCritical`** inlines the CSS needed for the initial view, removing a render blocking stylesheet request. On by default in production and worth leaving on.

**`fonts.inline`** downloads Google Fonts at build time and inlines the CSS, removing a third party request and the privacy concern with it.

**`define`** replaces identifiers at build time, which is how you get a version number into the bundle without an environment file.

```typescript
declare const APP_VERSION: string;

console.log(`Version ${APP_VERSION}`);
```

**`loader`** lets you import files the build does not normally understand.

```typescript
import readme from './README.md';
```

**`hidden: true`** on source maps generates them without the comment linking them, so they can be uploaded to an error tracker without being served to users.

## Named configurations

```json
{
  "configurations": {
    "production": {
      "optimization": true,
      "outputHashing": "all",
      "budgets": [{ "type": "initial", "maximumError": "1MB" }]
    },
    "staging": {
      "optimization": true,
      "sourceMap": true,
      "define": { "API_BASE": "\"https://staging-api.example.com\"" }
    },
    "development": {
      "optimization": false,
      "sourceMap": true
    }
  },
  "defaultConfiguration": "production"
}
```

```bash
ng build --configuration=staging
```

Configurations compose, so `--configuration=production,analytics` merges both.

## Custom builders

A builder is a function the CLI runs for a target. Writing one lets `ng run` drive any tool.

```typescript
// builders/version-stamp/index.ts
import { createBuilder, BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import { writeFile } from 'node:fs/promises';

interface Options {
  outputPath: string;
}

export default createBuilder(
  async (options: Options, context: BuilderContext): Promise<BuilderOutput> => {
    context.logger.info('Writing build metadata');

    try {
      const metadata = {
        version: process.env['npm_package_version'],
        builtAt: new Date().toISOString(),
        commit: process.env['GIT_COMMIT'] ?? 'unknown',
      };

      await writeFile(options.outputPath, JSON.stringify(metadata, null, 2));

      return { success: true };
    } catch (error) {
      context.logger.error(String(error));
      return { success: false };
    }
  },
);
```

```json
// builders.json
{
  "builders": {
    "version-stamp": {
      "implementation": "./dist/builders/version-stamp",
      "schema": "./builders/version-stamp/schema.json",
      "description": "Writes build metadata to a file"
    }
  }
}
```

```json
// angular.json
{
  "architect": {
    "stamp": {
      "builder": "./tools:version-stamp",
      "options": { "outputPath": "dist/build-info.json" }
    }
  }
}
```

```bash
ng run my-app:stamp
```

## Composing builders

The more useful pattern: wrap the standard build and add a step.

```typescript
import { createBuilder, BuilderContext, targetFromTargetString } from '@angular-devkit/architect';

export default createBuilder(async (options, context: BuilderContext) => {
  const target = targetFromTargetString(options.buildTarget);

  const run = await context.scheduleTarget(target);
  const result = await run.result;

  await run.stop();

  if (!result.success) return result;

  await generateSitemap(options.outputPath);
  await writeBuildMetadata(options.outputPath);

  return result;
});
```

`scheduleTarget` runs another target and waits for it. Now `ng build` produces the application plus a sitemap plus metadata, in one command.

## Postbuild scripts

For most needs, a script is simpler than a builder.

```json
{
  "scripts": {
    "build": "ng build && node tools/postbuild.mjs",
    "build:analyse": "ng build --stats-json && npx webpack-bundle-analyzer dist/my-app/stats.json"
  }
}
```

Write a builder when it needs to run inside `ng build`, be reused across projects in a workspace, or be published as part of a library. Otherwise a script does the job with far less ceremony.

## Extending with a plugin

The esbuild based builder does not expose its plugin API directly. When you genuinely need one, the usual approaches are:

**A custom builder** wrapping the build and doing the extra work before or after.

**Vite plugins** in the dev server, configured through the builder's options where supported.

**Preprocessing** as a separate npm script, generating files the build then consumes.

The last is the most reliable. Generating TypeScript from an OpenAPI schema, or icons from SVG files, as a prebuild step keeps the build itself standard.

```json
{
  "scripts": {
    "prebuild": "npm run generate:api && npm run generate:icons",
    "build": "ng build"
  }
}
```

npm runs `prebuild` automatically before `build`.

## Multiple applications in one workspace

```json
{
  "projects": {
    "admin": { "root": "projects/admin", "architect": { "build": { ... } } },
    "portal": { "root": "projects/portal", "architect": { "build": { ... } } },
    "shared-ui": { "projectType": "library", "root": "projects/shared-ui" }
  }
}
```

```bash
ng build admin
ng build portal
ng build shared-ui
```

Both applications import from the library through a path mapping, so shared code is written once.

For a workspace of any size, Nx adds dependency graph awareness and caching that plain Angular CLI does not have. That has its own topic.

## Build performance

```bash
ng build --verbose
```

Common causes of a slow build:

**A large `assets` glob** copying thousands of files.

**Many barrel files**, which force the bundler to analyse more than necessary.

**Sass with deep imports**, where each component recompiles a large shared file.

**Source maps in production** when you do not need them served.

The application builder is fast. A build taking minutes usually has one of these causes rather than being inherently slow.

## Quick recap

- `@angular/build:application` is the current esbuild based builder.
- Migrate an older webpack build with `ng update --name use-application-builder`.
- `define` injects build time constants without an environment file.
- `hidden: true` source maps can be uploaded to an error tracker but are not served.
- Named configurations compose, so `--configuration=a,b` merges both.
- A custom builder is worth it when the step must run inside `ng build`.
- A `prebuild` npm script is the simplest way to generate code before building.

<code id="code-content" class="language-typescript">
import { createBuilder, BuilderContext, BuilderOutput,
         targetFromTargetString } from '@angular-devkit/architect';
import { writeFile } from 'node:fs/promises';
// The most useful builder pattern: WRAP the standard build and add a step.
// Now `ng build` produces the app plus a sitemap plus metadata, in one command.
export default createBuilder(async (options: any, context: BuilderContext):
    Promise&lt;BuilderOutput&gt; =&gt; {
  const target = targetFromTargetString(options.buildTarget);
  const run = await context.scheduleTarget(target);   // run the real build
  const result = await run.result;
  await run.stop();
  if (!result.success) return result;
  context.logger.info('Writing build metadata');
  await writeFile(`${options.outputPath}/build-info.json`, JSON.stringify({
    version: process.env['npm_package_version'],
    builtAt: new Date().toISOString(),
    commit: process.env['GIT_COMMIT'] ?? 'unknown',
  }, null, 2));
  return result;
});
// angular.json build options worth knowing:
//   "outputHashing": "all"
//   "sourceMap": { "scripts": true, "hidden": true }
//       hidden = generated but NOT linked, so you can upload them to an
//       error tracker without serving them to users
//   "optimization": {
//     "styles": { "inlineCritical": true },   removes a render blocking request
//     "fonts": { "inline": true }             removes the Google Fonts request
//   }
//   "define": { "APP_VERSION": "\"1.4.0\"" }
//       a build time constant with no environment file:
//         declare const APP_VERSION: string;
//   "loader": { ".md": "text" }
//       import readme from './README.md';
// Named configurations COMPOSE:
//   ng build --configuration=production,analytics
// Migrate an older webpack build:
//   ng update @angular/cli --name use-application-builder
// FOR MOST NEEDS a script is simpler than a builder. npm runs `prebuild`
// automatically before `build`:
//   "prebuild": "npm run generate:api &amp;&amp; npm run generate:icons",
//   "build": "ng build"
// Write a builder only when the step must run INSIDE ng build, be reused
// across a workspace, or ship as part of a library.
// Slow build? Usually one of: a huge assets glob, many barrel files,
// deep Sass imports recompiled per component, or unnecessary source maps.
//   ng build --verbose
</code></pre>
