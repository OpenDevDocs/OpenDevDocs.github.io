---
publishDate: 2026-06-04T06:55
title: 'Legacy Structural Directives: ngIf, ngFor and ngSwitch'
slug: legacy-structural-directives
metadescription: Read and maintain ngIf, ngFor and ngSwitch in existing codebases, and understand the asterisk syntax they are built on.
updateDate: 2026-09-07T06:55
author: ['bishal-biswas']
level: 1
tags: ['legacy', 'directives', 'ngif']
course: angular
---

## Still everywhere

`@if` and `@for` are the modern way. But most Angular code written before 2024 uses structural directives, and you will read a lot of it.

```html
<div *ngIf="user">{{ user.name }}</div>
<li *ngFor="let item of items">{{ item }}</li>
```

They are not deprecated, and they still work in Angular 22. Understanding them is a maintenance skill.

## They need importing

Unlike the new blocks, these are directives and must be imported.

```typescript
import { Component } from '@angular/core';
import { NgIf, NgFor, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';

@Component({
  selector: 'app-legacy',
  imports: [NgIf, NgFor, NgSwitch, NgSwitchCase, NgSwitchDefault],
  template: `...`,
})
export class Legacy {}
```

Older code imports `CommonModule` instead, which brings all of them plus the pipes:

```typescript
import { CommonModule } from '@angular/common';

@Component({ imports: [CommonModule], ... })
```

`CommonModule` is convenient and pulls in more than you use. Importing the individual directives is leaner.

## ngIf

```html
<div *ngIf="isLoggedIn">Welcome back</div>

<!-- with an else branch -->
<div *ngIf="user; else noUser">{{ user.name }}</div>
<ng-template #noUser>
  <p>Please sign in</p>
</ng-template>

<!-- then and else together -->
<div *ngIf="loading; then spinner; else content"></div>
<ng-template #spinner><app-spinner /></ng-template>
<ng-template #content><app-results /></ng-template>

<!-- capturing the value -->
<div *ngIf="user$ | async as user">{{ user.name }}</div>
```

That last pattern is very common in older codebases. `async` unwraps an observable, and `as user` stores the result so the template does not subscribe repeatedly.

`ngIf` **removes the element from the DOM** rather than hiding it. That is the difference from `[hidden]` or a CSS class, and it matters: a removed component is destroyed, losing its state.

```html
<div *ngIf="visible">created and destroyed</div>
<div [hidden]="!visible">stays in the DOM, just invisible</div>
```

## ngFor

```html
<li *ngFor="let item of items">{{ item.name }}</li>

<!-- with the loop variables -->
<li *ngFor="let item of items; let i = index; let isFirst = first">
  {{ i }}: {{ item.name }}
</li>

<!-- with trackBy -->
<li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>
```

```typescript
protected trackById(index: number, item: Item): number {
  return item.id;
}
```

The available variables are `index`, `first`, `last`, `even`, `odd` and `count`, aliased with `let`.

**`trackBy` was optional**, and that was the design mistake `@for` fixed by making `track` mandatory. Most `*ngFor` loops in the wild have no `trackBy`, which means every data refresh rebuilds the entire list.

If you are maintaining old code and a list feels sluggish or loses input focus, a missing `trackBy` is the first thing to check.

## ngSwitch

```html
<div [ngSwitch]="role">
  <app-admin-panel *ngSwitchCase="'admin'" />
  <app-editor-tools *ngSwitchCase="'editor'" />
  <app-viewer *ngSwitchDefault />
</div>
```

Note the asymmetry: `[ngSwitch]` is a property binding on the container, while the cases are structural directives on the children. That inconsistency is one reason `@switch` was introduced.

## What the asterisk actually means

The `*` is shorthand. Angular expands it into an `ng-template`.

```html
<!-- what you write -->
<div *ngIf="isVisible">Hello</div>

<!-- what Angular sees -->
<ng-template [ngIf]="isVisible">
  <div>Hello</div>
</ng-template>
```

```html
<!-- what you write -->
<li *ngFor="let item of items; trackBy: trackById">{{ item }}</li>

<!-- what Angular sees -->
<ng-template ngFor let-item [ngForOf]="items" [ngForTrackBy]="trackById">
  <li>{{ item }}</li>
</ng-template>
```

Understanding this explains the rule everyone hits eventually.

## One structural directive per element

```html
<!-- this is an error -->
<li *ngIf="item.visible" *ngFor="let item of items">{{ item.name }}</li>
```

Both want to wrap the element in their own `ng-template`, and Angular cannot decide which wins. The workaround is `ng-container`, which groups without adding an element:

```html
<ng-container *ngFor="let item of items">
  <li *ngIf="item.visible">{{ item.name }}</li>
</ng-container>
```

With the new syntax this problem simply does not exist:

```html
@for (item of items(); track item.id) {
  @if (item.visible) {
    <li>{{ item.name }}</li>
  }
}
```

## ngIf with async

The old way of rendering asynchronous data, and still very common.

```typescript
export class UserList {
  protected readonly users$ = this.http.get<User[]>('/api/users');
}
```

```html
<ng-container *ngIf="users$ | async as users; else loading">
  <li *ngFor="let user of users; trackBy: trackById">{{ user.name }}</li>
</ng-container>
<ng-template #loading><app-spinner /></ng-template>
```

The modern equivalent is much shorter:

```typescript
protected readonly users = httpResource<User[]>(() => '/api/users');
```

```html
@if (users.isLoading()) {
  <app-spinner />
} @else {
  @for (user of users.value() ?? []; track user.id) {
    <li>{{ user.name }}</li>
  }
}
```

## Migrating

```bash
ng generate @angular/core:control-flow
```

The migration converts `*ngIf`, `*ngFor` and `*ngSwitch`, moves `else` templates into `@else` blocks, converts `trackBy` functions into `track` expressions, and removes the now unused imports.

It handles the great majority of cases. Review the diff for templates that used `ng-template` in unusual ways.

There is no rush. Old templates work fine. Migrate when you are already touching the file, or in one deliberate pass with a good test suite.

## Quick recap

- `*ngIf`, `*ngFor` and `*ngSwitch` still work and are all over existing code.
- They are directives, so they must be imported, unlike `@if` and `@for`.
- `*ngIf` removes the element and destroys the component, it does not hide it.
- `trackBy` was optional and usually missing, which is why lists rebuild needlessly.
- The `*` expands to an `ng-template`, which is why only one is allowed per element.
- Use `ng-container` to combine two structural directives.
- `ng generate @angular/core:control-flow` converts a codebase automatically.

<code id="code-content" class="language-typescript">
import { Component } from '@angular/core';
import { NgIf, NgFor, NgSwitch, NgSwitchCase, NgSwitchDefault, AsyncPipe } from '@angular/common';
// Unlike @if and @for, these are DIRECTIVES and must be imported.
// Older code imports CommonModule instead, which brings all of them plus pipes.
@Component({
  selector: 'app-legacy',
  imports: [NgIf, NgFor, NgSwitch, NgSwitchCase, NgSwitchDefault, AsyncPipe],
  template: `
    &lt;!-- ngIf REMOVES the element and destroys the component --&gt;
    &lt;div *ngIf="user"&gt;{{ user.name }}&lt;/div&gt;
    &lt;!-- else needs a named ng-template --&gt;
    &lt;div *ngIf="user; else noUser"&gt;{{ user.name }}&lt;/div&gt;
    &lt;ng-template #noUser&gt;&lt;p&gt;Please sign in&lt;/p&gt;&lt;/ng-template&gt;
    &lt;!-- the very common async + as pattern in older codebases --&gt;
    &lt;div *ngIf="users$ | async as users"&gt;{{ users.length }} users&lt;/div&gt;
    &lt;!-- trackBy was OPTIONAL, and usually missing. That is why lists rebuild. --&gt;
    &lt;li *ngFor="let item of items; let i = index; trackBy: trackById"&gt;
      {{ i }}: {{ item.name }}
    &lt;/li&gt;
    &lt;!-- ngSwitch: a property binding on the parent, directives on the children --&gt;
    &lt;div [ngSwitch]="role"&gt;
      &lt;app-admin-panel *ngSwitchCase="'admin'" /&gt;
      &lt;app-viewer *ngSwitchDefault /&gt;
    &lt;/div&gt;
    &lt;!-- ONE structural directive per element. Use ng-container to combine. --&gt;
    &lt;ng-container *ngFor="let item of items"&gt;
      &lt;li *ngIf="item.visible"&gt;{{ item.name }}&lt;/li&gt;
    &lt;/ng-container&gt;
  `,
})
export class Legacy {
  protected user: { name: string } | null = null;
  protected items: { id: number; name: string; visible: boolean }[] = [];
  protected role = 'viewer';
  protected users$ = fetchUsers();
  protected trackById(index: number, item: { id: number }): number { return item.id; }
}
// The * is shorthand. Angular expands it into an ng-template:
//   &lt;div *ngIf="x"&gt;Hi&lt;/div&gt;
//   becomes  &lt;ng-template [ngIf]="x"&gt;&lt;div&gt;Hi&lt;/div&gt;&lt;/ng-template&gt;
// That is exactly why two structural directives cannot share one element.
// Migrate with:  ng generate @angular/core:control-flow
</code></pre>
