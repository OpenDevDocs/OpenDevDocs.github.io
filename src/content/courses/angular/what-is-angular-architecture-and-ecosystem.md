---
publishDate: 2026-06-01T06:00
title: What is Angular? Architecture and Ecosystem
slug: what-is-angular-architecture-and-ecosystem
metadescription: Understand what Angular is, how a modern Angular application is put together, and which parts of older Angular you will still meet in real projects.
updateDate: 2026-09-07T06:00
author: ['bishal-biswas']
level: 1
tags: ['introduction', 'architecture', 'overview']
course: angular
---

## What Angular is

Angular is a framework for building web applications with TypeScript. Google builds it, and it ships as a complete package rather than a library you assemble yourself.

That is the main thing separating it from React. React gives you a rendering library and you choose everything else. Angular gives you routing, forms, HTTP, testing, a build system and a command line tool, all designed together and all versioned together.

For a small side project that is more than you need. For an application that a team maintains for five years, it means far fewer decisions and far fewer arguments.

## The current version

Angular 22 is the current stable release, out in June 2026. Angular ships a major version roughly every six months, in May and November, and each one is supported for 18 months.

The version numbers move fast, but do not let that alarm you. Upgrades are usually a single command, because the framework ships automated migrations that rewrite your code for you.

## What a component looks like

Everything in Angular is built from components. A component is a class with a decorator, a template, and some styles.

```typescript
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-counter',
  template: `
    <p>Count: {{ count() }}</p>
    <button (click)="increment()">Add one</button>
  `,
})
export class Counter {
  protected readonly count = signal(0);

  protected increment(): void {
    this.count.update(n => n + 1);
  }
}
```

Three things to notice, because they are the shape of modern Angular.

**`signal(0)`** creates a piece of reactive state. Reading it is `count()`, with brackets. When it changes, only the parts of the page that read it are updated.

**`{{ count() }}`** in the template is interpolation. The template is HTML with extra syntax, not JavaScript that returns HTML.

**No `standalone: true`.** Components have been standalone by default since Angular 19. Older code has that flag written out, and it still works.

## The pieces of an application

```text
Component     a piece of UI: a class, a template and styles
Directive     behaviour you attach to an existing element
Pipe          a value transformer used in templates, like a date formatter
Service       a class holding logic or state, shared through dependency injection
Router        maps URLs to components
```

You will spend most of your time writing components and services. The rest supports them.

## How the parts connect

Dependency injection is how Angular wires things together. A service declares itself available, and anything that needs it asks for it.

```typescript
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<string | null>(null);

  load(id: string) {
    return this.http.get<{ name: string }>(`/api/users/${id}`);
  }
}
```

```typescript
import { Component, inject } from '@angular/core';
import { UserService } from './user-service';

@Component({
  selector: 'app-profile',
  template: `<p>{{ users.currentUser() ?? 'Nobody' }}</p>`,
})
export class Profile {
  protected readonly users = inject(UserService);
}
```

`providedIn: 'root'` means one shared instance for the whole application. `inject()` asks for it. Nothing has to be registered by hand, and nothing has to be passed down through components.

## The big shift you need to know about

Angular changed substantially between roughly version 14 and version 20. If you search for Angular help online, you will find answers from both eras, and they look very different.

```text
Old Angular                          Modern Angular
NgModules everywhere                 standalone components
constructor(private http: HttpClient) inject(HttpClient)
@Input() name: string                 name = input<string>()
@Output() saved = new EventEmitter    saved = output<string>()
*ngIf and *ngFor                      @if and @for
Zone.js patching everything           zoneless change detection
RxJS for all state                    signals for state, RxJS for streams
FormGroup and FormControl             signal forms
```

**Both columns still work.** Angular does not break your application when it introduces a better way. The old patterns are supported, and millions of lines of production code use them.

This course teaches the right hand column as the default, and the left hand column where you need it, because you will read that code, maintain it, and migrate it.

## What ships in the box

```text
@angular/core            components, signals, dependency injection
@angular/common          pipes, directives, HttpClient
@angular/forms           reactive, template-driven and signal forms
@angular/router          routing
@angular/platform-browser bootstrapping in a browser
@angular/ssr             server-side rendering
@angular/cli             the ng command
```

Optional but common: `@angular/material` for components, `@angular/cdk` for behaviour primitives, `@angular/aria` for accessible patterns, and `rxjs` for streams.

## Where Angular fits

Angular suits applications that are large, long lived and worked on by several people. Enterprise dashboards, internal tools, banking and healthcare systems, anything with a lot of forms.

The strong opinions and the consistent structure mean a developer joining in year three finds a familiar codebase. That is the real selling point.

It is heavier than it needs to be for a marketing page or a small widget. Something lighter fits those better.

## What you need before starting

**JavaScript**, properly. Modules, promises, arrow functions, destructuring, classes.

**TypeScript** basics. The next topic covers what Angular actually uses.

**HTML and CSS.** Angular templates are HTML.

You do **not** need RxJS to start. Modern Angular uses signals for most state, and RxJS is covered later for the cases where streams genuinely help.

## Quick recap

- Angular is a complete framework, not a rendering library you assemble around.
- Angular 22 is current, with a new major version every six months and easy upgrades.
- Components, directives, pipes and services are the building blocks.
- Dependency injection with `inject()` connects everything together.
- Signals are the modern way to hold state, and templates read them with brackets.
- Angular changed a lot recently, and both the old and new styles still work.
- This course teaches modern Angular first, and the older patterns you will still meet.

<code id="code-content" class="language-typescript">
import { Component, Injectable, inject, signal } from '@angular/core';
// A service: one shared instance, available anywhere via inject()
@Injectable({ providedIn: 'root' })
export class CounterStore {
  readonly count = signal(0);                  // reactive state
  increment() { this.count.update(n =&gt; n + 1); }
}
// A component: a class, a template and some styles
@Component({
  selector: 'app-counter',
  template: `
    &lt;p&gt;Count: {{ store.count() }}&lt;/p&gt;
    &lt;button (click)="store.increment()"&gt;Add one&lt;/button&gt;
    @if (store.count() &gt; 5) {
      &lt;p&gt;That is plenty.&lt;/p&gt;
    }
  `,
})
export class Counter {
  protected readonly store = inject(CounterStore);   // no constructor needed
}
// Components are standalone by default since Angular 19.
// Older code writes `standalone: true` explicitly, and still works.
// The shift you will see in real codebases:
//   constructor(private http: HttpClient)  -&gt;  inject(HttpClient)
//   @Input() name: string                  -&gt;  name = input&lt;string&gt;()
//   @Output() saved = new EventEmitter()   -&gt;  saved = output&lt;string&gt;()
//   *ngIf / *ngFor                         -&gt;  @if / @for
//   FormGroup / FormControl                -&gt;  form() from @angular/forms/signals
// BOTH styles still work. Angular does not break your app to move forward.
</code></pre>
