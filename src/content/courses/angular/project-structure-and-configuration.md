---
publishDate: 2026-06-01T06:15
title: Project Structure and Configuration Files
slug: project-structure-and-configuration
metadescription: Learn what every file in a new Angular project does, and which configuration settings you will actually need to change.
updateDate: 2026-09-07T06:15
author: ['bishal-biswas']
level: 1
tags: ['configuration', 'project structure', 'tooling']
course: angular
---

## What ng new creates

```text
my-app/
├── src/
│   ├── app/
│   │   ├── app.ts             the root component
│   │   ├── app.html           its template
│   │   ├── app.css            its styles
│   │   ├── app.config.ts      application providers
│   │   └── app.routes.ts      route definitions
│   ├── index.html             the single HTML page
│   ├── main.ts                the entry point
│   └── styles.css             global styles
├── public/                    static files copied as-is
├── angular.json               build and tooling configuration
├── package.json               dependencies and scripts
├── tsconfig.json              TypeScript configuration
└── tsconfig.app.json          TypeScript for the application build
```

Older projects also have `src/app/app.module.ts` and `src/environments/`. Both are covered below.

## main.ts, the entry point

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch(err => console.error(err));
```

Three lines. Take the root component, take the configuration, start the application.

Older applications call `platformBrowserDynamic().bootstrapModule(AppModule)` instead, which starts from an NgModule rather than a component.

## app.config.ts, where providers live

This is the file you will edit most often during setup. Everything the application needs is registered here.

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor]),
    ),
  ],
};
```

The pattern is consistent: every Angular feature exposes a `provideSomething()` function, and you add it here. Routing, HTTP, animations, service workers, forms and state libraries all follow it.

This replaced the old approach of importing `RouterModule.forRoot(routes)` and `HttpClientModule` into an NgModule.

## index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MyApp</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

Two lines matter.

`<base href="/">` tells the router where the application is mounted. Deploying to a subfolder means changing it, or passing `--base-href` at build time.

`<app-root>` is where the root component renders. The tag name is the root component's `selector`.

You rarely edit anything else here. Scripts and styles are injected by the build.

## angular.json

The big one. It configures how each project in the workspace is built, served and tested.

```json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "browser": "src/main.ts",
            "index": "src/index.html",
            "tsConfig": "tsconfig.app.json",
            "assets": [{ "glob": "**/*", "input": "public" }],
            "styles": ["src/styles.css"]
          },
          "configurations": {
            "production": {
              "budgets": [
                { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
              ],
              "outputHashing": "all"
            },
            "development": {
              "optimization": false,
              "sourceMap": true
            }
          },
          "defaultConfiguration": "production"
        }
      }
    }
  }
}
```

The settings you will actually touch:

**`styles` and `scripts`.** Global CSS and JavaScript files, such as a CSS framework.

**`assets`.** Files copied to the output untouched. Images, fonts, `robots.txt`.

**`budgets`.** Size limits that fail the build when the bundle grows too large. Genuinely useful, and covered in the performance section.

**`configurations`.** Named sets of overrides. `ng build --configuration=staging` uses the one called `staging`.

**`schematics`.** Defaults for generated files, so you stop repeating flags.

## Environment configuration

Older Angular had `src/environments/environment.ts` and `environment.prod.ts`, swapped at build time by a `fileReplacements` rule.

```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
};
```

```json
"configurations": {
  "production": {
    "fileReplacements": [{
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }]
  }
}
```

This still works and plenty of projects use it. New projects do not create these files, and the modern alternative is an injection token:

```typescript
export interface AppConfig {
  apiUrl: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');

// in app.config.ts
providers: [
  { provide: APP_CONFIG, useValue: { apiUrl: '/api' } },
]
```

The token version is testable, since a test can provide a different value without touching the build.

Either way, **nothing in a browser build is secret**. Anything you put in these files ships to the user. API keys belong on a server.

## tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "target": "ES2022",
    "moduleResolution": "bundler",
    "paths": {
      "@app/*": ["src/app/*"],
      "@shared/*": ["src/app/shared/*"]
    }
  },
  "angularCompilerOptions": {
    "strictTemplates": true,
    "typeCheckHostBindings": true
  }
}
```

`paths` is worth setting up early. It turns this:

```typescript
import { UserService } from '../../../core/services/user-service';
```

into this:

```typescript
import { UserService } from '@app/core/services/user-service';
```

`strictTemplates` type checks your templates. Leave it on.

## Organising app code

The CLI does not impose a folder structure. A convention that scales:

```text
src/app/
├── core/          singletons: services, interceptors, guards
├── shared/        reusable components, directives and pipes
├── features/
│   ├── users/
│   └── orders/    one folder per feature, lazily loaded
├── app.ts
├── app.config.ts
└── app.routes.ts
```

The rule that matters: **features do not import from each other.** They import from `core` and `shared`. When two features need the same thing, it moves to `shared`. That single rule prevents most dependency tangles.

## package.json scripts

```json
{
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test"
  }
}
```

`npm start` works because `start` is a special npm name. Everything else needs `npm run build`, `npm run test` and so on.

## Quick recap

- `main.ts` bootstraps the root component with `app.config.ts`.
- Every Angular feature is turned on with a `provideSomething()` function in `app.config.ts`.
- `<base href="/">` in `index.html` must match where you deploy.
- `angular.json` holds assets, global styles, budgets and named build configurations.
- The old `environments` folder still works, but an injection token is more testable.
- Nothing in a browser build is secret, so keep keys on the server.
- Set up `paths` aliases early, and keep features from importing each other.

<code id="code-content" class="language-typescript">
// main.ts: take the root component, take the config, start the app
import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationConfig, InjectionToken } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
// app.config.ts: every feature is a provideSomething() call
export interface AppSettings { apiUrl: string; }
export const APP_SETTINGS = new InjectionToken&lt;AppSettings&gt;('app.settings');
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([]),
    provideHttpClient(withFetch(), withInterceptors([])),
    // Modern replacement for the old environment.ts file swap.
    // Testable: a test can provide a different value.
    { provide: APP_SETTINGS, useValue: { apiUrl: '/api' } },
  ],
};
// bootstrapApplication(App, appConfig).catch(err =&gt; console.error(err));
// Older apps instead do:
//   platformBrowserDynamic().bootstrapModule(AppModule)
// index.html has two lines that matter:
//   &lt;base href="/"&gt;      must match where you deploy
//   &lt;app-root&gt;&lt;/app-root&gt;  the root component's selector
// tsconfig paths turn ../../../core/user-service into @app/core/user-service
// {
//   "paths": { "@app/*": ["src/app/*"], "@shared/*": ["src/app/shared/*"] },
//   "angularCompilerOptions": { "strictTemplates": true }
// }
// Folder layout that scales. The rule: features never import each other.
//   core/      singletons: services, interceptors, guards
//   shared/    reusable components, directives, pipes
//   features/  one folder each, lazily loaded
// NOTHING in a browser build is secret. API keys belong on a server.
</code></pre>
