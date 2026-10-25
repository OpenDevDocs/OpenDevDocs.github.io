---
publishDate: 2026-06-09T08:20
title: NgModules and the Legacy Architecture
slug: ngmodules-and-legacy-architecture
metadescription: Read and maintain NgModule based Angular, understand declarations, imports and exports, and the problems that led to standalone components.
updateDate: 2026-09-07T08:20
author: ['bishal-biswas']
level: 2
tags: ['legacy', 'ngmodules', 'architecture']
course: angular
---

## What an NgModule is

Before standalone components, every component, directive and pipe had to belong to an NgModule. The module declared what it owned and what it could use.

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
  declarations: [UserListComponent, UserCardComponent, HighlightDirective],
  imports: [CommonModule, RouterModule],
  exports: [UserListComponent],
  providers: [UserService],
})
export class UsersModule {}
```

Four properties do the work.

**`declarations`** lists the components, directives and pipes this module owns. Each one belongs to exactly one module, ever.

**`imports`** lists other modules whose exported pieces this module's templates may use.

**`exports`** lists which of this module's declarations other modules may use.

**`providers`** registers services.

## The root module

```typescript
@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    RouterModule.forRoot(routes),
    UsersModule,
  ],
  providers: [
    { provide: API_URL, useValue: '/api' },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

`bootstrap` names the component to render first, and only the root module has it.

```typescript
// main.ts
platformBrowserDynamic().bootstrapModule(AppModule);
```

## forRoot and forChild

Modules that hold global state used a static method convention.

```typescript
RouterModule.forRoot(routes)     // once, in the root module
RouterModule.forChild(routes)    // in each lazily loaded module
```

`forRoot` returned providers as well as declarations. `forChild` returned only declarations, so importing it twice did not create two routers.

Calling `forRoot` in a feature module was a classic bug: two router instances, or two copies of a store, with confusing symptoms.

The `provideRouter()` function replaced this whole pattern, and cannot be misused the same way.

## Lazy loading

```typescript
const routes: Routes = [
  {
    path: 'users',
    loadChildren: () => import('./users/users.module').then(m => m.UsersModule),
  },
];
```

```typescript
@NgModule({
  declarations: [UserListComponent, UserDetailComponent],
  imports: [CommonModule, RouterModule.forChild(userRoutes)],
})
export class UsersModule {}
```

The module was the unit of lazy loading, which meant creating a module just to lazily load one component.

Standalone components can be loaded directly:

```typescript
{
  path: 'users',
  loadComponent: () => import('./users/user-list').then(m => m.UserList),
}
```

## The SharedModule problem

The pattern nearly every project ended up with:

```typescript
@NgModule({
  declarations: [ButtonComponent, CardComponent, TruncatePipe],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule],
  exports: [
    CommonModule, FormsModule, ReactiveFormsModule, MaterialModule,
    ButtonComponent, CardComponent, TruncatePipe,
  ],
})
export class SharedModule {}
```

Convenient. Import one module and everything is available.

The cost: a component needing only `TruncatePipe` pulled in the whole of Material, both forms modules and every shared component. Tree shaking could not help, because the module genuinely referenced all of it.

Shared modules grew until they were imported everywhere and depended on everything. Untangling one is a well known chore.

Standalone components fixed this by making dependencies per component rather than per module.

## CoreModule

The other convention, for singletons.

```typescript
@NgModule({
  providers: [AuthService, LoggerService],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parent: CoreModule) {
    if (parent) {
      throw new Error('CoreModule is already loaded. Import it once, in AppModule.');
    }
  }
}
```

That constructor guard existed because importing `CoreModule` in a lazily loaded module created a **second** set of services. Two `AuthService` instances, two sources of truth, and a bug that was hard to find.

`@Injectable({ providedIn: 'root' })` removed the need for `CoreModule` completely.

## The problems, summarised

**Boilerplate.** Every component needed a module entry, and every new module needed wiring.

**Indirection.** Looking at a template, you could not tell which module supplied a directive without hunting through imports.

**Poor tree shaking.** Importing a module pulled in everything it exported.

**Confusing errors.** A missing declaration produced messages about unknown elements or property binding errors, rarely pointing at the real cause.

**Two ways to provide a service**, with different singleton behaviour.

## What you still need modules for

Very little, but not nothing.

**Library compatibility.** Some libraries still ship NgModules. Import them into a standalone component's `imports` array.

```typescript
@Component({
  imports: [MatButtonModule, ReactiveFormsModule],
  ...
})
```

**`FormsModule` and `ReactiveFormsModule`** are still modules in Angular itself.

**Bridging providers** from a legacy module:

```typescript
providers: [importProvidersFrom(SomeLegacyModule)]
```

## Reading an NgModule codebase

When you land in one, orient yourself like this.

**Find the root module** to see the global providers and imports.

**Find the routes** to see which modules are lazily loaded.

**Look for `SharedModule`** to know what a random component can already use.

**Look for `CoreModule`** to know where the singletons are.

**Check for `forRoot` calls outside the root module**, which is a bug worth reporting.

## Mixing standalone and modules

Both work in one application, and this is how migrations proceed.

```typescript
// a standalone component used inside an NgModule
@NgModule({
  declarations: [OldComponent],
  imports: [CommonModule, NewStandaloneComponent],   // imports, not declarations
})
export class FeatureModule {}
```

The rule: **standalone things go in `imports`, never `declarations`.** Putting one in `declarations` is a compile error, and it is the mistake everyone makes once.

Going the other way, a standalone component can import a whole module:

```typescript
@Component({
  imports: [SharedModule],
  ...
})
export class NewThing {}
```

That works and defeats the purpose. Import the individual pieces instead.

## Quick recap

- An NgModule declares what it owns, imports what it uses and exports what it shares.
- Every declarable belonged to exactly one module.
- `forRoot` and `forChild` prevented duplicate global providers, and were easy to misuse.
- `SharedModule` made everything available and made tree shaking impossible.
- `CoreModule` needed a constructor guard to stay a singleton.
- Standalone components can import modules, and modules can import standalone components.
- Standalone things go in `imports`, never in `declarations`.

<code id="code-content" class="language-typescript">
import { NgModule, Optional, SkipSelf, importProvidersFrom } from '@angular/core';
import { CommonModule } from '@angular/common';
// A feature module: declares what it owns, imports what it uses, exports what it shares
@NgModule({
  declarations: [UserListComponent, HighlightDirective],   // owned, one module each
  imports: [CommonModule, RouterModule.forChild(routes)],  // forChild, not forRoot
  exports: [UserListComponent],                            // visible to importers
  providers: [UserService],
})
export class UsersModule {}
// The root module. Only this one has `bootstrap`.
@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, HttpClientModule, RouterModule.forRoot(routes)],
  bootstrap: [AppComponent],
})
export class AppModule {}
// main.ts:  platformBrowserDynamic().bootstrapModule(AppModule)
// The SharedModule problem: needing one pipe pulled in ALL of this.
// Tree shaking could not help, because the module genuinely referenced it all.
@NgModule({
  declarations: [ButtonComponent, TruncatePipe],
  exports: [CommonModule, FormsModule, MaterialModule, ButtonComponent, TruncatePipe],
})
export class SharedModule {}
// CoreModule needed a guard, because importing it from a LAZY module
// created a SECOND set of singletons. providedIn: 'root' removed the need.
@NgModule({ providers: [AuthService] })
export class CoreModule {
  constructor(@Optional() @SkipSelf() parent: CoreModule) {
    if (parent) throw new Error('CoreModule is already loaded');
  }
}
// Mixing the two. The rule: standalone things go in IMPORTS, never declarations.
@NgModule({
  declarations: [OldComponent],
  imports: [CommonModule, NewStandaloneComponent],   // NOT declarations
})
export class FeatureModule {}
// And a standalone component can bridge a legacy module's providers:
//   providers: [importProvidersFrom(SomeLegacyModule)]
// It works, and it defeats tree shaking. Import the individual pieces instead.
</code></pre>
