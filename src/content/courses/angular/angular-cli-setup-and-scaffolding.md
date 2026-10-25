---
publishDate: 2026-06-01T06:10
title: 'Angular CLI: Setup and Scaffolding'
slug: angular-cli-setup-and-scaffolding
metadescription: Install the Angular CLI, create a project, and learn the handful of ng commands you will type every day.
updateDate: 2026-09-07T06:10
author: ['bishal-biswas']
level: 1
tags: ['cli', 'tooling', 'setup']
course: angular
---

## What the CLI does

The Angular CLI creates projects, generates files, runs a dev server, builds for production and runs migrations. It is not optional in practice. Everything in the Angular world assumes you are using it.

## Installing

You need Node.js. Take the LTS version from nodejs.org.

```bash
node --version
npm --version
```

Then install the CLI globally:

```bash
npm install -g @angular/cli
ng version
```

`ng version` prints the CLI version, the Angular version and the Node version, which is the first thing anyone will ask you when you report a problem.

You can skip the global install and use `npx` instead, which avoids the CLI version drifting away from your projects:

```bash
npx @angular/cli@latest new my-app
```

## Creating a project

```bash
ng new my-app
```

It asks a few questions. The ones that matter:

**Which stylesheet format?** CSS is fine. SCSS if your team uses it. This is hard to change later, so decide once.

**Enable server-side rendering?** Say no unless you know you need it. It can be added later with `ng add @angular/ssr`.

**Zoneless?** New projects default to zoneless in recent versions. Say yes. It is faster and it is where Angular is going.

Useful flags when you know what you want:

```bash
ng new my-app --style=scss --ssr=false --routing
ng new my-app --minimal          # no tests, no comments, smallest setup
ng new my-workspace --no-create-application   # an empty workspace for libraries
```

## Running it

```bash
cd my-app
ng serve
```

That starts a dev server on `http://localhost:4200` and rebuilds when you save. A few flags are worth knowing:

```bash
ng serve --open              # open the browser too
ng serve --port 4300         # a different port
ng serve --host 0.0.0.0      # reachable from other devices on your network
ng serve --configuration=production   # serve the production build locally
```

## Generating files

This is where the CLI saves real time. It creates the file, writes the boilerplate and updates anything that needs updating.

```bash
ng generate component user-profile
ng generate service auth
ng generate directive highlight
ng generate pipe format-date
ng generate guard admin
ng generate interceptor logging
ng generate resolver user
ng generate pipe truncate
```

`g` is short for `generate`, and each type has a short name:

```bash
ng g c user-profile
ng g s auth
ng g d highlight
ng g p format-date
```

Useful flags:

```bash
ng g c user-profile --inline-template --inline-style
ng g c user-profile --skip-tests
ng g c shared/ui/button          # nested in folders
ng g c user-profile --dry-run    # show what would happen, change nothing
```

`--dry-run` is worth the habit. It prints the files it would create without touching anything.

## What a generated component looks like

```bash
ng g c user-profile
```

```text
CREATE src/app/user-profile/user-profile.ts
CREATE src/app/user-profile/user-profile.html
CREATE src/app/user-profile/user-profile.css
CREATE src/app/user-profile/user-profile.spec.ts
```

Notice there is no `.component.ts`. Modern Angular dropped the role suffix from file names. Older projects still use `user-profile.component.ts`, and the CLI respects whatever the project is already configured for.

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-user-profile',
  imports: [],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css',
})
export class UserProfile {}
```

## Building

```bash
ng build                       # production build into dist/
ng build --configuration=development
ng build --stats-json          # emit stats for bundle analysis
```

`ng build` defaults to the production configuration, which minifies, tree shakes, hashes filenames and enables ahead of time compilation.

## Testing

```bash
ng test                # unit tests
ng test --watch=false  # single run, for CI
ng e2e                 # end to end, if configured
```

Recent Angular versions use Vitest as the default unit test runner for new projects. Older projects use Karma and Jasmine, and both are still supported.

## Adding libraries

`ng add` is not the same as `npm install`. It installs the package **and** runs its setup schematic, which wires it into your project.

```bash
ng add @angular/material      # installs, sets up theming and typography
ng add @angular/ssr           # adds server-side rendering
ng add @angular/pwa           # adds a service worker and manifest
ng add @ngrx/store            # installs and registers the store
```

Using plain `npm install` for these leaves you to do the configuration by hand.

## Updating

```bash
ng update                              # what can be updated
ng update @angular/core @angular/cli   # update Angular itself
```

This is the command that makes Angular's release pace manageable. It updates the packages **and** runs migration schematics that rewrite your code for renamed APIs.

Always commit before running it, so you can read the diff and back out cleanly.

## Running migrations by hand

The migrations that modernise your code can also be run individually.

```bash
ng generate @angular/core:standalone                # NgModules to standalone
ng generate @angular/core:control-flow              # *ngIf and *ngFor to @if and @for
ng generate @angular/core:signal-input-migration    # @Input to input()
ng generate @angular/core:output-migration          # @Output to output()
ng generate @angular/core:signal-queries-migration  # @ViewChild to viewChild()
ng generate @angular/core:inject                    # constructor to inject()
ng generate @angular/core:self-closing-tag          # self-closing component tags
```

These are covered properly later, but it is worth knowing now that modernising an old codebase is largely automated.

## Configuring defaults

Repeating flags gets tedious. Put them in `angular.json` instead.

```json
{
  "projects": {
    "my-app": {
      "schematics": {
        "@schematics/angular:component": {
          "style": "scss",
          "skipTests": false,
          "changeDetection": "OnPush"
        }
      }
    }
  }
}
```

Now every generated component uses those settings.

## The commands worth memorising

```bash
ng serve
ng g c some-name
ng g s some-name
ng build
ng test
ng update
```

That is genuinely most of it.

## Quick recap

- The CLI creates, generates, serves, builds, tests and migrates. Use it.
- `ng new` asks questions that are awkward to change later, especially the stylesheet format.
- `ng g c name` scaffolds a component, and `--dry-run` shows what it would do first.
- Modern projects generate `user-profile.ts`, not `user-profile.component.ts`.
- `ng add` runs a setup schematic, `npm install` does not.
- `ng update` upgrades packages and rewrites your code for renamed APIs.
- Put repeated flags in the `schematics` section of `angular.json`.

<code id="code-content" class="language-bash">
# Install the CLI, or use npx to avoid version drift
npm install -g @angular/cli
ng version                       # CLI, Angular and Node versions
# Create a project. The stylesheet choice is awkward to change later.
ng new my-app --style=scss --routing
cd my-app
# The dev server, rebuilding on save
ng serve --open --port 4300
# Generate files. g = generate, c = component, s = service.
ng g c user-profile              # creates .ts .html .css .spec.ts
ng g s auth
ng g d highlight                 # directive
ng g p format-date               # pipe
ng g guard admin
ng g interceptor logging
# --dry-run shows what would happen without touching anything
ng g c shared/ui/button --dry-run
# Build. ng build is production by default: minified, tree shaken, hashed.
ng build
ng build --stats-json            # for bundle analysis
# Test. New projects use Vitest, older ones use Karma and Jasmine.
ng test --watch=false
# ng add installs AND runs the setup schematic. npm install does not.
ng add @angular/material
ng add @angular/ssr
# Upgrade Angular and let it rewrite your code for renamed APIs
ng update                        # show what is available
ng update @angular/core @angular/cli
# Modernisation migrations can also be run one at a time
ng generate @angular/core:standalone
ng generate @angular/core:control-flow
ng generate @angular/core:signal-input-migration
ng generate @angular/core:inject
</code></pre>
