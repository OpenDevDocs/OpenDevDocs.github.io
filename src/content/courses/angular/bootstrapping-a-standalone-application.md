---
publishDate: 2026-06-02T06:20
title: Bootstrapping a Standalone Application
slug: bootstrapping-a-standalone-application
metadescription: Start an Angular application without NgModules, register providers with provide functions, and understand what bootstrapApplication actually does.
updateDate: 2026-09-07T06:20
author: ['bishal-biswas']
level: 1
tags: ['bootstrapping', 'standalone', 'providers']
course: angular
---

## Starting an application

Bootstrapping is the moment Angular takes over a page. One function does it.

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig)
  .catch(err => console.error(err));
```

Angular finds the element matching the root component's selector in `index.html`, creates the component, and renders it there.

`bootstrapApplication` returns a promise, so the `.catch` matters. Without it, a failure during startup is a silent blank page.

## The configuration object

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
  ],
};
```

`ApplicationConfig` has one property that matters: `providers`. Everything available to the whole application is registered there.

You can inline it, which is fine for tiny applications:

```typescript
bootstrapApplication(App, {
  providers: [provideRouter(routes)],
});
```

Keeping it in `app.config.ts` is better once there is more than a line or two, because tests can import and reuse it.

## The provide functions

Every Angular feature exposes a function starting with `provide`. This is the pattern to learn, because everything follows it.

```typescript
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),   // route params become component inputs
      withViewTransitions(),          // animate between routes
    ),
    provideHttpClient(
      withFetch(),                    // use fetch instead of XMLHttpRequest
      withInterceptors([authInterceptor]),
    ),
    provideAnimationsAsync(),
  ],
};
```

The `withSomething()` functions are optional features. They are separate so that anything you do not use is removed by tree shaking, which keeps the bundle small.

That is the real reason this design exists. The old `HttpClientModule` pulled in everything whether you used it or not.

## Your own providers

Anything you can provide in a component, you can provide here for the whole application.

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    // a value
    { provide: API_URL, useValue: 'https://api.example.com' },

    // swap an implementation
    { provide: Logger, useClass: ConsoleLogger },

    // build it yourself
    {
      provide: AnalyticsService,
      useFactory: () => new AnalyticsService(inject(API_URL)),
    },

    // run something at startup
    provideAppInitializer(() => {
      const config = inject(ConfigService);
      return config.load();      // startup waits for this promise
    }),
  ],
};
```

`provideAppInitializer` is the one worth remembering. It runs before the application renders, and if it returns a promise, Angular waits. Loading runtime configuration or checking an existing session belongs here.

It replaced the older `APP_INITIALIZER` token, which did the same job with more ceremony.

## Global error handling

```typescript
import { provideBrowserGlobalErrorListeners, ErrorHandler } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: MyErrorHandler },
  ],
};
```

```typescript
@Injectable()
export class MyErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('Unhandled', error);
    // send it to your logging service
  }
}
```

New projects include `provideBrowserGlobalErrorListeners()`, which catches unhandled promise rejections and window errors as well as Angular's own.

## The root component

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <header>My App</header>
    <router-outlet />
  `,
})
export class App {}
```

The selector must match the tag in `index.html`. Everything else is an ordinary component.

Note `<router-outlet />` written self-closing. Angular templates have supported that for components and directives since version 16, and it reads better than a redundant closing tag.

## What the old way looked like

You will meet this in existing projects.

```typescript
// main.ts, the NgModule way
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
```

```typescript
// app.module.ts
@NgModule({
  declarations: [AppComponent, UserProfileComponent],
  imports: [BrowserModule, HttpClientModule, RouterModule.forRoot(routes)],
  providers: [UserService],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

The mapping is direct:

```text
imports: [HttpClientModule]           ->  provideHttpClient()
imports: [RouterModule.forRoot(...)]  ->  provideRouter(routes)
imports: [BrowserAnimationsModule]    ->  provideAnimationsAsync()
providers: [UserService]              ->  @Injectable({ providedIn: 'root' })
declarations: [...]                    ->  each component imports what it uses
bootstrap: [AppComponent]              ->  bootstrapApplication(App, ...)
```

Both bootstrap styles still work. `ng generate @angular/core:standalone` converts one to the other.

## Mixing the two

A standalone application can still use an old NgModule from a library that has not been updated. `importProvidersFrom` bridges the gap.

```typescript
import { importProvidersFrom } from '@angular/core';
import { SomeLegacyModule } from 'some-old-library';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(SomeLegacyModule),
  ],
};
```

Use it only when a library forces you to. It defeats tree shaking, since Angular cannot tell which parts of the module you actually need.

## Bootstrapping for server rendering

With SSR there are two configurations, and the server one merges into the browser one.

```typescript
// app.config.server.ts
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/ssr';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering()],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```

`mergeApplicationConfig` combines provider lists, so shared setup is written once.

## Quick recap

- `bootstrapApplication(App, appConfig)` starts a modern Angular application.
- Always `.catch()` it, or a startup failure is a blank page.
- Every feature is switched on with a `provideSomething()` function.
- The `withSomething()` options are separate so unused code is tree shaken away.
- `provideAppInitializer` runs before rendering and can await a promise.
- The old `bootstrapModule(AppModule)` still works, and maps directly onto the new functions.
- `importProvidersFrom` bridges to legacy library modules, at the cost of tree shaking.

<code id="code-content" class="language-typescript">
import { ApplicationConfig, inject, provideAppInitializer, ErrorHandler } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
// Every feature is a provideSomething() call. The withSomething() options are
// separate so anything you do not use is tree shaken out of the bundle.
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([], withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([])),
    // Your own providers work exactly the same way
    { provide: 'API_URL', useValue: 'https://api.example.com' },
    // Runs BEFORE the app renders. Returning a promise makes startup wait.
    provideAppInitializer(() =&gt; {
      const settings = inject(SettingsService);
      return settings.load();
    }),
    { provide: ErrorHandler, useClass: MyErrorHandler },
  ],
};
// bootstrapApplication(App, appConfig).catch(err =&gt; console.error(err));
// Without the .catch, a startup failure is a silent blank page.
// The old NgModule way, which still works:
//   platformBrowserDynamic().bootstrapModule(AppModule)
// The mapping is direct:
//   imports: [HttpClientModule]            -&gt;  provideHttpClient()
//   imports: [RouterModule.forRoot(...)]   -&gt;  provideRouter(routes)
//   providers: [UserService]               -&gt;  @Injectable({providedIn:'root'})
//   bootstrap: [AppComponent]              -&gt;  bootstrapApplication(App, ...)
// Stuck with a legacy library module? Bridge it, but you lose tree shaking:
//   importProvidersFrom(SomeLegacyModule)
</code></pre>
