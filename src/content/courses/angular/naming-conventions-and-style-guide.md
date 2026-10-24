---
publishDate: 2026-06-02T06:25
title: Naming Conventions and the Modern Style Guide
slug: naming-conventions-and-style-guide
metadescription: Learn the modern Angular file and class naming rules, why the .component.ts suffix went away, and when to keep the old style.
updateDate: 2026-09-07T06:25
author: ['bishal-biswas']
level: 1
tags: ['style guide', 'conventions', 'naming']
course: angular
---

## The suffix went away

Angular's style guide changed in version 20. File names no longer carry a role suffix.

```text
Old                              New
user-profile.component.ts        user-profile.ts
user-profile.component.html      user-profile.html
user-profile.component.css       user-profile.css
user-profile.component.spec.ts   user-profile.spec.ts
auth.service.ts                  auth.ts
highlight.directive.ts           highlight.ts
format-date.pipe.ts              format-date.ts
```

Class names changed too:

```text
Old                     New
UserProfileComponent    UserProfile
AuthService             Auth  (or AuthService, see below)
HighlightDirective      Highlight
FormatDatePipe          FormatDate
```

The reasoning: the suffix repeated information the code already states. A class with `@Component` on it is obviously a component. Typing `Component` twice in every import adds nothing.

## What the CLI does

`ng generate` follows whatever the project already uses. A project created before version 20 keeps its suffixes, and a new one does not. You do not have to choose, and you should not mix styles inside one project.

```bash
ng g c user-profile
```

In a modern project:

```text
CREATE src/app/user-profile/user-profile.ts
CREATE src/app/user-profile/user-profile.html
CREATE src/app/user-profile/user-profile.css
CREATE src/app/user-profile/user-profile.spec.ts
```

## Naming for intent, not role

The guide asks you to name things for what they are, not what kind of Angular object they are.

```typescript
// Components: describe the thing
export class UserProfile {}      // user-profile.ts
export class OrderSummary {}     // order-summary.ts
export class ConfirmDialog {}    // confirm-dialog.ts

// Directives: describe the behaviour
export class Highlight {}        // highlight.ts
export class Autofocus {}        // autofocus.ts

// Pipes: describe the transformation
export class FormatDate {}       // format-date.ts
export class Truncate {}         // truncate.ts
```

## Services keep their suffix, usually

Services are the exception people trip over. A file called `auth.ts` holding a class called `Auth` is vague, and it collides with an `Auth` interface.

The practical guidance: keep `Service` on the class when the alternative is ambiguous.

```typescript
// auth.ts
export class AuthService {}      // clearer than plain Auth

// or name it for what it holds
// auth-store.ts
export class AuthStore {}
```

Models and interfaces keep a clear name:

```typescript
// user.model.ts
export interface User {
  id: number;
  name: string;
}
```

Now `User` is the data and `UserProfile` is the component, with no collision.

## One name across the file set

Whatever the base name is, every related file shares it.

```text
user-profile.ts
user-profile.html
user-profile.css
user-profile.spec.ts
```

This is what makes a file tree readable. Editors group them, and searching for `user-profile` finds everything.

## Selectors

Component selectors are kebab case with a prefix. The prefix is `app` by default and configurable per project.

```typescript
@Component({ selector: 'app-user-profile' })
@Component({ selector: 'admin-user-list' })   // a different prefix per feature area
```

Directive selectors are camel case in brackets:

```typescript
@Directive({ selector: '[appHighlight]' })
```

The prefix prevents collisions with real HTML elements and with library components. `<user-profile>` could clash with a future standard element. `<app-user-profile>` will not.

Set the prefix in `angular.json`:

```json
{
  "projects": {
    "my-app": {
      "prefix": "app"
    }
  }
}
```

## Members and visibility

Modern Angular style marks anything only the template uses as `protected`.

```typescript
@Component({
  selector: 'app-counter',
  template: `
    <p>{{ label }}: {{ count() }}</p>
    <button (click)="increment()">Add</button>
  `,
})
export class Counter {
  protected readonly label = 'Total';       // template only
  protected readonly count = signal(0);     // template only
  protected increment(): void { ... }       // template only

  readonly total = computed(() => this.count() * 2);   // public API
}
```

Templates can read `public` and `protected` members but not `private` ones. Marking template members `protected` keeps the class's public surface honest, so other code cannot depend on internals.

Mark signals and injected services `readonly`. They are never reassigned, only read or updated.

```typescript
private readonly http = inject(HttpClient);
readonly users = signal<User[]>([]);
```

## Folder structure

```text
src/app/
├── core/                 singletons used across the app
│   ├── auth.ts
│   └── error-handler.ts
├── shared/               reusable, no feature knowledge
│   ├── button/
│   └── format-date.ts
├── features/
│   ├── users/
│   │   ├── user-list/
│   │   ├── user-detail/
│   │   └── users.routes.ts
│   └── orders/
├── app.ts
├── app.config.ts
└── app.routes.ts
```

One rule keeps this healthy: **features never import from other features.** They import from `core` and `shared`. When two features need the same thing, move it to `shared`.

## Should you rename an existing project?

No. Not on its own.

Renaming every file creates an enormous diff, breaks everyone's open branches, and destroys the useful parts of `git blame`. There is no runtime benefit whatsoever.

Sensible approaches:

- Keep the existing convention across the whole project.
- Or use the new style for genuinely new folders, and leave old code alone.

Consistency within a folder matters far more than matching the latest guide. A codebase where half the files are renamed is worse than one that is uniformly old fashioned.

## Quick recap

- Angular 20 dropped the `.component.ts` and `Component` suffixes.
- The CLI follows whatever the project already uses, so you do not have to choose.
- Name for intent, and keep `Service` where the alternative would be ambiguous.
- All files for one thing share a base name.
- Selectors are prefixed and kebab case, directives are camel case in brackets.
- Mark template-only members `protected`, and mark signals and injections `readonly`.
- Do not mass rename an existing project. Consistency beats fashion.

<code id="code-content" class="language-typescript">
import { Component, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
// Modern Angular (v20+): no .component.ts suffix, no Component in the class name.
// File: user-profile.ts  +  user-profile.html  +  user-profile.css
@Component({
  selector: 'app-user-profile',        // prefixed, kebab case
  template: `
    &lt;p&gt;{{ label }}: {{ count() }}&lt;/p&gt;
    &lt;button (click)="increment()"&gt;Add&lt;/button&gt;
  `,
})
export class UserProfile {             // not UserProfileComponent
  // Template-only members are protected: readable in the template,
  // invisible to other code. Signals and injections are readonly.
  protected readonly label = 'Total';
  protected readonly count = signal(0);
  private readonly http = inject(HttpClient);
  // Genuine public API stays public
  readonly doubled = computed(() =&gt; this.count() * 2);
  protected increment(): void { this.count.update(n =&gt; n + 1); }
}
// Services are the exception: keep the suffix when the alternative is vague.
//   auth.ts        -&gt;  export class AuthService {}   (clearer than `Auth`)
//   user.model.ts  -&gt;  export interface User {}      (no collision)
// Directives and pipes drop the suffix like components:
//   highlight.ts   -&gt;  export class Highlight {}     selector: '[appHighlight]'
//   format-date.ts -&gt;  export class FormatDate {}
// Do NOT mass rename an existing project. Huge diff, no runtime benefit,
// and it destroys git blame. Consistency inside a folder beats fashion.
</code></pre>
