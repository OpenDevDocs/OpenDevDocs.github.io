---
publishDate: 2026-06-09T08:25
title: Migrating from NgModules to Standalone
slug: migrating-ngmodules-to-standalone
metadescription: Convert an NgModule application to standalone components in safe stages, using the CLI schematic and knowing what to check by hand.
updateDate: 2026-09-07T08:25
author: ['bishal-biswas']
level: 2
tags: ['migration', 'standalone', 'ngmodules']
course: angular
---

## The three stages

Angular ships a schematic that does most of this, and it deliberately works in three passes. Run them in order, building and committing between each.

```bash
ng generate @angular/core:standalone
```

It asks which step to run:

```text
1. Convert all components, directives and pipes to standalone
2. Remove unnecessary NgModule classes
3. Bootstrap the project using standalone APIs
```

**Do not run all three blindly.** Run step one, build, run the tests, commit. Then step two. Then step three.

## Step one: make declarables standalone

Every component, directive and pipe gains `standalone: true` and an `imports` array containing what its template actually uses.

```typescript
// before
@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
})
export class UserCardComponent {}

@NgModule({
  declarations: [UserCardComponent],
  imports: [CommonModule, RouterModule],
})
export class UsersModule {}
```

```typescript
// after
@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink],
  templateUrl: './user-card.component.html',
})
export class UserCardComponent {}
```

The schematic works out the imports by analysing each template, which is why it is worth letting it do this rather than doing it by hand.

Modules still exist at this point, but they now list the components in `imports` instead of `declarations`. The application still works.

In Angular 19 and later, `standalone: true` is the default and the flag is redundant. Leaving it is harmless.

## Step two: delete the modules

Modules with nothing left to declare are removed, and their imports pushed down to the components that need them.

Some modules survive, and that is correct:

- Modules with providers that are still needed.
- Modules imported by external code.
- Routing modules, until step three.

## Step three: bootstrap without modules

```typescript
// before
platformBrowserDynamic().bootstrapModule(AppModule);
```

```typescript
// after
bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule, SomeLegacyModule),
    provideRouter(routes),
    provideHttpClient(),
  ],
});
```

The schematic uses `importProvidersFrom` liberally, because it is the safe conversion. Replacing those with proper provide functions is the manual cleanup worth doing afterwards.

```typescript
// what the schematic writes
importProvidersFrom(HttpClientModule, RouterModule.forRoot(routes))

// what you should end up with
provideHttpClient(),
provideRouter(routes),
```

## The manual cleanup

The schematic gets you to working standalone code. These are the things to fix afterwards.

**Replace `importProvidersFrom`.**

```text
HttpClientModule                ->  provideHttpClient()
RouterModule.forRoot(routes)    ->  provideRouter(routes)
BrowserAnimationsModule         ->  provideAnimationsAsync()
StoreModule.forRoot(reducers)   ->  provideStore(reducers)
ServiceWorkerModule.register()  ->  provideServiceWorker()
```

**Replace `CommonModule` with individual directives.** The schematic may import the whole thing. Importing only `NgIf` and `NgFor` is leaner, and converting to `@if` and `@for` removes them entirely.

```bash
ng generate @angular/core:control-flow
```

**Move services to `providedIn: 'root'`.**

```typescript
// before, in a module
providers: [UserService]

// after
@Injectable({ providedIn: 'root' })
export class UserService {}
```

That makes the service tree shakeable and removes the provider entry.

**Delete `CoreModule` and its guard.** With `providedIn: 'root'`, the singleton problem it guarded against no longer exists.

**Break up `SharedModule`.** This is the biggest job and the biggest win. Instead of one module exporting everything, each component imports the two or three things it uses.

Do it gradually. Leave `SharedModule` in place, stop adding to it, and remove its usages as you touch files.

## Converting lazy routes

```typescript
// before
{
  path: 'users',
  loadChildren: () => import('./users/users.module').then(m => m.UsersModule),
}
```

```typescript
// after, a single component
{
  path: 'users',
  loadComponent: () => import('./users/user-list').then(m => m.UserList),
}

// after, a group of routes
{
  path: 'users',
  loadChildren: () => import('./users/users.routes').then(m => m.userRoutes),
}
```

```typescript
// users.routes.ts
export const userRoutes: Routes = [
  { path: '', component: UserList },
  { path: ':id', component: UserDetail },
];
```

Routes can also carry their own providers, which is the standalone replacement for a lazily loaded module's `providers`:

```typescript
{
  path: 'admin',
  providers: [AdminService],           // scoped to this route subtree
  loadChildren: () => import('./admin/admin.routes').then(m => m.adminRoutes),
}
```

## Doing it incrementally

You do not have to convert everything. A mixed application is fine, and for a large codebase it is the sensible approach.

**New code is standalone.** Set the default so the CLI generates it.

**Convert a feature at a time**, starting with a leaf feature that few things depend on.

**Convert shared components early**, since everything depends on them.

**Leave the root module until last**, because step three touches bootstrapping and is the riskiest change.

## What breaks

**Circular imports.** Modules hid these. Two components importing each other directly is a real cycle, and the build will say so. Usually the fix is extracting a shared piece.

**Services that were not `providedIn: 'root'`.** A service provided by a module that no longer exists loses its provider. The error is a clear "no provider for X", so it is easy to spot.

**Tests importing modules.**

```typescript
// before
TestBed.configureTestingModule({
  declarations: [UserCardComponent],
  imports: [CommonModule],
});

// after
TestBed.configureTestingModule({
  imports: [UserCard],
});
```

Standalone components go in `imports`. This is a mechanical change across every spec file.

**`entryComponents`.** Removed years ago and ignored. Delete it if you find it.

## Verifying

```bash
ng build
ng test
ng build --stats-json
```

Compare the bundle before and after. Breaking up a `SharedModule` usually produces a visible reduction in the initial bundle, which is a good way to show the work was worth doing.

## Quick recap

- `ng generate @angular/core:standalone` runs in three steps, and you should run them one at a time.
- Step one adds `imports` to every declarable, step two deletes modules, step three changes bootstrapping.
- The schematic uses `importProvidersFrom`, and replacing those with provide functions is the manual cleanup.
- Move module providers to `@Injectable({ providedIn: 'root' })`.
- Breaking up `SharedModule` is the biggest win and can be done gradually.
- `loadChildren` can point at a routes array instead of a module.
- Tests must move standalone components from `declarations` to `imports`.

<code id="code-content" class="language-bash">
# Run the three steps ONE AT A TIME, building and committing between each.
ng generate @angular/core:standalone
#   1. Convert all components, directives and pipes to standalone
#   2. Remove unnecessary NgModule classes
#   3. Bootstrap the project using standalone APIs
ng build &amp;&amp; ng test        # after every step
git commit -am "standalone: step 1"
# Then modernise the templates, which removes CommonModule entirely
ng generate @angular/core:control-flow
# The manual cleanup the schematic leaves behind. It writes
# importProvidersFrom(...) because that is the SAFE conversion. Replace with:
#   HttpClientModule               -&gt;  provideHttpClient()
#   RouterModule.forRoot(routes)   -&gt;  provideRouter(routes)
#   BrowserAnimationsModule        -&gt;  provideAnimationsAsync()
#   StoreModule.forRoot(reducers)  -&gt;  provideStore(reducers)
#   ServiceWorkerModule.register() -&gt;  provideServiceWorker()
# Module providers become tree shakeable singletons:
#   providers: [UserService]  in a module
#   -&gt;  @Injectable({ providedIn: 'root' }) on the service
# Lazy routes no longer need a module wrapper:
#   loadChildren: () =&gt; import('./users/users.module').then(m =&gt; m.UsersModule)
#   -&gt;  loadComponent: () =&gt; import('./users/user-list').then(m =&gt; m.UserList)
#   -&gt;  loadChildren:  () =&gt; import('./users/users.routes').then(m =&gt; m.userRoutes)
# Routes can carry their own providers, replacing a lazy module's providers:
#   { path: 'admin', providers: [AdminService], loadChildren: ... }
# Tests: standalone components move from declarations to imports.
#   TestBed.configureTestingModule({ imports: [UserCard] })
# Measure the win. Breaking up SharedModule usually shrinks the initial bundle.
ng build --stats-json
</code></pre>
