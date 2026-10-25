---
publishDate: 2026-06-29T13:50
title: Writing Custom Schematics
slug: custom-schematics
metadescription: 'Write CLI generators that scaffold code to your team''s conventions, and migrations that rewrite existing code.'
updateDate: 2026-09-07T13:50
author: ['bishal-biswas']
level: 4
tags: ['schematics', 'tooling', 'automation']
course: angular
---

## What a schematic is

A schematic is a code generator the CLI runs. `ng generate component` is one. So is every `ng update` migration that rewrites your code when an API is renamed.

Writing your own is worth it when a team repeatedly creates the same shape of code by hand, and it drifts.

```bash
npm install -g @angular-devkit/schematics-cli
schematics blank --name=my-schematics
```

## The structure

```text
my-schematics/
├── src/
│   ├── collection.json
│   └── feature/
│       ├── index.ts
│       ├── schema.json
│       └── files/
│           ├── __name@dasherize__.ts.template
│           └── __name@dasherize__.html.template
└── package.json
```

```json
// collection.json
{
  "$schema": "../node_modules/@angular-devkit/schematics/collection-schema.json",
  "schematics": {
    "feature": {
      "description": "Generates a feature with routes, a store and a component",
      "factory": "./feature/index#feature",
      "schema": "./feature/schema.json"
    }
  }
}
```

## Defining options

```json
// schema.json
{
  "$schema": "http://json-schema.org/schema",
  "$id": "Feature",
  "title": "Feature options",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "The feature name",
      "$default": { "$source": "argv", "index": 0 },
      "x-prompt": "What is the feature called?"
    },
    "path": {
      "type": "string",
      "format": "path",
      "description": "Where to create it"
    },
    "withStore": {
      "type": "boolean",
      "default": true,
      "x-prompt": "Include a signal store?"
    }
  },
  "required": ["name"]
}
```

`x-prompt` makes the CLI ask interactively when the option is not supplied. `$default` from `argv` lets the name be the first positional argument.

## The factory

```typescript
import { Rule, SchematicContext, Tree, apply, url, applyTemplates,
         move, mergeWith, chain } from '@angular-devkit/schematics';
import { strings, normalize } from '@angular-devkit/core';

export function feature(options: FeatureOptions): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const targetPath = normalize(options.path ?? `src/app/features/${strings.dasherize(options.name)}`);

    const templateSource = apply(url('./files'), [
      applyTemplates({
        ...strings,
        ...options,
      }),
      move(targetPath),
    ]);

    return chain([
      mergeWith(templateSource),
      addRouteToApp(options),
    ])(tree, context);
  };
}
```

`Tree` is a virtual filesystem. Nothing is written to disk until the schematic finishes, which is what makes `--dry-run` possible and safe.

`strings` supplies the case helpers used in templates: `dasherize`, `camelize`, `classify`, `underscore`.

## Templates

```typescript
// files/__name@dasherize__.ts.template
import { Component, inject } from '@angular/core';
<% if (withStore) { %>
import { <%= classify(name) %>Store } from './<%= dasherize(name) %>.store';
<% } %>

@Component({
  selector: 'app-<%= dasherize(name) %>',
  templateUrl: './<%= dasherize(name) %>.html',
})
export class <%= classify(name) %> {
<% if (withStore) { %>
  protected readonly store = inject(<%= classify(name) %>Store);
<% } %>
}
```

The filename `__name@dasherize__.ts.template` becomes `user-profile.ts` for a name of `userProfile`. The `__x__` syntax substitutes an option, and `@dasherize` applies a case helper.

The `.template` extension is stripped, which stops the build system trying to compile the template as real code.

## Modifying existing files

The harder part. Adding a route to an existing file means parsing it.

```typescript
import { Rule, Tree, SchematicsException } from '@angular-devkit/schematics';
import * as ts from 'typescript';

function addRouteToApp(options: FeatureOptions): Rule {
  return (tree: Tree) => {
    const routesPath = 'src/app/app.routes.ts';
    const content = tree.read(routesPath);

    if (!content) {
      throw new SchematicsException(`Could not find ${routesPath}`);
    }

    const source = ts.createSourceFile(
      routesPath,
      content.toString(),
      ts.ScriptTarget.Latest,
      true,
    );

    const newRoute = `  {
    path: '${strings.dasherize(options.name)}',
    loadChildren: () => import('./features/${strings.dasherize(options.name)}/routes')
      .then(m => m.routes),
  },`;

    const text = content.toString();
    const insertAt = text.indexOf('export const routes: Routes = [') +
      'export const routes: Routes = ['.length;

    const updated = text.slice(0, insertAt) + '\n' + newRoute + text.slice(insertAt);

    tree.overwrite(routesPath, updated);

    return tree;
  };
}
```

String manipulation like this is fragile. For anything more than a simple insertion, use the TypeScript compiler API to find the right node, or `ts-morph` which is far more pleasant.

Angular's own schematics use the compiler API precisely because string matching breaks on formatting differences.

## Testing

```typescript
import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';

describe('feature schematic', () => {
  const runner = new SchematicTestRunner('schematics', collectionPath);

  it('creates the expected files', async () => {
    const tree = await runner.runSchematic('feature', { name: 'userProfile' }, Tree.empty());

    expect(tree.files).toContain('/src/app/features/user-profile/user-profile.ts');
    expect(tree.files).toContain('/src/app/features/user-profile/user-profile.html');
  });

  it('names the class correctly', async () => {
    const tree = await runner.runSchematic('feature', { name: 'userProfile' }, Tree.empty());

    const content = tree.readContent('/src/app/features/user-profile/user-profile.ts');

    expect(content).toContain('export class UserProfile');
  });
});
```

Test schematics properly. A broken generator that produces wrong code across a team is worse than no generator.

## Running it

```bash
npm run build
npm link

cd ../my-app
npm link my-schematics

ng generate my-schematics:feature user-profile
ng generate my-schematics:feature user-profile --dry-run
```

`--dry-run` prints what would change without writing anything, which is the first thing to check.

Set it as the default collection to shorten the command:

```json
// angular.json
{
  "cli": {
    "schematicCollections": ["my-schematics", "@schematics/angular"]
  }
}
```

```bash
ng generate feature user-profile
```

## Migration schematics

The other kind: rewriting existing code when your library changes an API.

```json
// migrations.json
{
  "schematics": {
    "rename-old-service": {
      "version": "3.0.0",
      "description": "Renames OldService to NewService",
      "factory": "./migrations/rename-service/index"
    }
  }
}
```

```json
// package.json
{
  "ng-update": {
    "migrations": "./migrations.json"
  }
}
```

Now `ng update my-library` runs the migration automatically when upgrading past version 3.

This is what makes Angular's own upgrades manageable, and it is a genuine kindness to publish one when you rename something in a shared library. Consumers get the change applied rather than a list of errors.

## Before you write one

**A file template** in your editor covers a lot, with none of the maintenance.

**`ng generate` with defaults** in `angular.json` handles conventions like `OnPush` and stylesheet format.

**A shell script** copying and renaming files is often enough.

Write a schematic when the generation is genuinely complex, must modify existing files, needs to be shared as a package, or ships as a migration for a library.

The maintenance is real: a schematic breaks when the code it generates goes out of date, and a generator producing outdated patterns is worse than no generator.

## Quick recap

- A schematic is a CLI generator, and `Tree` is a virtual filesystem so nothing writes until it finishes.
- `x-prompt` in the schema makes the CLI ask interactively.
- Templates use `__name@dasherize__` in filenames and `<%= %>` inside.
- Modifying existing files needs the TypeScript compiler API, not string matching.
- Test schematics with `SchematicTestRunner`, since a broken generator spreads.
- Register a default collection so `ng generate feature` works without the prefix.
- Publish migration schematics when you rename an API in a shared library.

<code id="code-content" class="language-typescript">
import { Rule, SchematicContext, Tree, SchematicsException,
         apply, url, applyTemplates, move, mergeWith, chain } from '@angular-devkit/schematics';
import { strings, normalize } from '@angular-devkit/core';
interface FeatureOptions { name: string; path?: string; withStore: boolean; }
export function feature(options: FeatureOptions): Rule {
  // Tree is a VIRTUAL filesystem. Nothing hits disk until the schematic
  // finishes, which is what makes --dry-run safe.
  return (tree: Tree, context: SchematicContext) =&gt; {
    const target = normalize(options.path
      ?? `src/app/features/${strings.dasherize(options.name)}`);
    const templates = apply(url('./files'), [
      // strings supplies dasherize, camelize, classify, underscore
      applyTemplates({ ...strings, ...options }),
      move(target),
    ]);
    return chain([mergeWith(templates), addRoute(options)])(tree, context);
  };
}
// Modifying an EXISTING file is the hard part. String matching like this
// is fragile: use the TypeScript compiler API or ts-morph for anything
// beyond a simple insertion. Angular's own schematics use the compiler API
// precisely because string matching breaks on formatting differences.
function addRoute(options: FeatureOptions): Rule {
  return (tree: Tree) =&gt; {
    const path = 'src/app/app.routes.ts';
    const content = tree.read(path);
    if (!content) throw new SchematicsException(`Could not find ${path}`);
    const marker = 'export const routes: Routes = [';
    const text = content.toString();
    const at = text.indexOf(marker) + marker.length;
    const route = `\n  { path: '${strings.dasherize(options.name)}',
    loadChildren: () =&gt; import('./features/${strings.dasherize(options.name)}/routes')
      .then(m =&gt; m.routes) },`;
    tree.overwrite(path, text.slice(0, at) + route + text.slice(at));
    return tree;
  };
}
// TEMPLATES. The filename __name@dasherize__.ts.template becomes
// user-profile.ts for a name of userProfile. The .template extension is
// stripped so the build does not try to compile it.
//   @Component({ selector: 'app-&lt;%= dasherize(name) %&gt;' })
//   export class &lt;%= classify(name) %&gt; {
//     &lt;% if (withStore) { %&gt;
//     protected readonly store = inject(&lt;%= classify(name) %&gt;Store);
//     &lt;% } %&gt;
//   }
// schema.json: x-prompt makes the CLI ask interactively
//   "name": { "type": "string",
//             "$default": { "$source": "argv", "index": 0 },
//             "x-prompt": "What is the feature called?" }
// TEST IT. A broken generator producing wrong code across a team is
// worse than no generator.
//   const tree = await runner.runSchematic('feature', { name: 'userProfile' }, Tree.empty());
//   expect(tree.files).toContain('/src/app/features/user-profile/user-profile.ts');
// Run it, checking first:
//   ng generate my-schematics:feature user-profile --dry-run
// Register a default collection to drop the prefix:
//   "cli": { "schematicCollections": ["my-schematics", "@schematics/angular"] }
// MIGRATION schematics rewrite consumers' code on upgrade. Publishing one
// when you rename an API is a genuine kindness: consumers get the change
// applied rather than a list of errors.
//   package.json:  "ng-update": { "migrations": "./migrations.json" }
// BEFORE WRITING ONE: an editor file template, ng generate defaults in
// angular.json, or a shell script often cover it with no maintenance.
</code></pre>
