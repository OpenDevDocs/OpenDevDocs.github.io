---
publishDate: 2026-06-10T08:35
title: Constructor Injection and Decorator Modifiers
slug: constructor-injection-and-modifiers
metadescription: Read constructor based dependency injection in existing Angular code, and understand the Optional, Self, SkipSelf and Host decorators.
updateDate: 2026-09-07T08:35
author: ['bishal-biswas']
level: 2
tags: ['legacy', 'dependency injection', 'constructor']
course: angular
---

## The older style

Before `inject()`, dependencies came through the constructor.

```typescript
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({ ... })
export class UserListComponent {
  constructor(
    private http: HttpClient,
    private router: Router,
    public userService: UserService,
  ) {}

  load(): void {
    this.http.get<User[]>('/api/users').subscribe(...);
  }
}
```

The access modifier on a constructor parameter is TypeScript shorthand. `private http: HttpClient` declares the field and assigns it in one line.

Without a modifier, it is just a parameter:

```typescript
constructor(http: HttpClient) {}     // not stored, unusable later
constructor(private http: HttpClient) {}   // becomes this.http
```

This still works in Angular 22 and is throughout existing code.

## How Angular knows the type

Angular reads the parameter types using decorator metadata, which requires `emitDecoratorMetadata` in `tsconfig.json`. That works for classes but not for interfaces, since interfaces vanish at compile time.

```typescript
constructor(private config: AppConfig) {}       // fine if AppConfig is a class
constructor(private config: IAppConfig) {}      // fails, an interface has no runtime value
```

For anything not a class you needed `@Inject`:

```typescript
constructor(@Inject(API_URL) private apiUrl: string) {}
```

`inject()` has no such issue, because the token is passed as a value rather than inferred from a type.

```typescript
private readonly apiUrl = inject(API_URL);
```

## The modifier decorators

Four decorators changed how the lookup worked.

**`@Optional()`** returns `null` instead of throwing.

```typescript
constructor(@Optional() private logger: LoggerService | null) {}

log(message: string): void {
  this.logger?.write(message);
}
```

**`@Self()`** only looks at this element's own injector.

```typescript
constructor(@Self() private validator: NG_VALIDATORS) {}
```

**`@SkipSelf()`** starts the search at the parent, skipping this injector.

```typescript
constructor(@SkipSelf() private parentForm: FormGroupDirective) {}
```

**`@Host()`** stops the search at the host component, not going further up.

```typescript
constructor(@Host() private control: NgControl) {}
```

They combine, and the classic pairing guarded singletons:

```typescript
@NgModule({ providers: [AuthService] })
export class CoreModule {
  constructor(@Optional() @SkipSelf() parent: CoreModule) {
    if (parent) throw new Error('CoreModule is already loaded');
  }
}
```

`@SkipSelf()` looks for another `CoreModule` above this one, and `@Optional()` stops it throwing when there is none. Finding one meant the module had been imported twice.

## The inject equivalents

```typescript
// constructor                                inject
@Optional() private x: Thing | null           inject(Thing, { optional: true })
@Self() private x: Thing                      inject(Thing, { self: true })
@SkipSelf() private x: Thing                  inject(Thing, { skipSelf: true })
@Host() private x: Thing                      inject(Thing, { host: true })
@Inject(TOKEN) private x: string              inject(TOKEN)
@Optional() @SkipSelf() private x: Thing      inject(Thing, { optional: true, skipSelf: true })
```

An options object instead of stacked decorators. Easier to read and easier to type.

## Why inject is better

**It works with inheritance.** A base class with constructor injection forces every subclass to repeat the parameters and call `super()` with them.

```typescript
// painful
export abstract class BaseComponent {
  constructor(protected http: HttpClient, protected router: Router) {}
}

export class UserList extends BaseComponent {
  constructor(http: HttpClient, router: Router, private users: UserService) {
    super(http, router);
  }
}
```

```typescript
// with inject
export abstract class BaseComponent {
  protected readonly http = inject(HttpClient);
  protected readonly router = inject(Router);
}

export class UserList extends BaseComponent {
  private readonly users = inject(UserService);
  // no constructor at all
}
```

Adding a dependency to the base class no longer touches every subclass.

**It works in functions.** Guards, resolvers and interceptors became plain functions because of it.

**No metadata requirement.** `emitDecoratorMetadata` and the `reflect-metadata` polyfill are unnecessary.

**Better types.** `inject(Thing, { optional: true })` returns `Thing | null`, inferred correctly. The decorator version relied on you annotating the type honestly.

**Shorter.** No constructor at all in most components.

## Mixing the two

Both work in one class, which is what a partial migration looks like.

```typescript
export class UserList {
  private readonly users = inject(UserService);

  constructor(private http: HttpClient) {}
}
```

Fine, though a class with both styles reads oddly. Convert the whole class at once.

## Migrating

```bash
ng generate @angular/core:inject
```

It converts constructor parameters into field initialisers, translates the modifier decorators into options, and removes the constructor when it becomes empty.

Two things to check afterwards.

**Constructor bodies.** If the constructor did work as well as taking dependencies, that work stays and the fields move above it. Make sure the ordering still makes sense, since field initialisers run before the constructor body.

**Subclasses.** Where a base class had constructor injection, the `super()` calls change. Convert base and subclasses together.

## When constructor injection is still fine

There is no urgency. Constructor injection is not deprecated and works exactly as it always did.

Convert when:

- You are already rewriting the class.
- Inheritance is causing repetitive constructors.
- You want to drop `emitDecoratorMetadata`.
- The team has agreed on one style.

A stable service with three constructor parameters does not need touching.

## Quick recap

- Constructor injection with access modifiers is the older style and still works.
- It relies on decorator metadata, so interfaces need `@Inject` with a token.
- `@Optional`, `@Self`, `@SkipSelf` and `@Host` change how the lookup walks the injector tree.
- `@Optional() @SkipSelf()` was the standard guard against a module being imported twice.
- `inject()` takes the same behaviour as an options object.
- `inject()` removes the repetitive `super()` calls that inheritance forced.
- Migrate with `ng generate @angular/core:inject`, and convert base classes with their subclasses.

<code id="code-content" class="language-typescript">
import { Component, Inject, Optional, Self, SkipSelf, Host, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
// The older style. The access modifier is TypeScript shorthand:
// `private http` declares the field AND assigns it.
@Component({ selector: 'app-old', template: `` })
export class OldStyle {
  constructor(
    private http: HttpClient,
    public userService: UserService,
    // Angular reads these types from decorator METADATA, which needs
    // emitDecoratorMetadata. Interfaces vanish at compile time, so
    // anything that is not a class needs an explicit token:
    @Inject(API_URL) private apiUrl: string,
    // The four modifiers change how the injector tree is searched
    @Optional() private logger: LoggerService | null,     // null, not a throw
    @Self() private ownOnly: Config,                       // this injector only
    @SkipSelf() private fromParent: Theme,                 // start at the parent
    @Host() private hostControl: NgControl,                // stop at the host
  ) {}
}
// The classic singleton guard: look for ANOTHER CoreModule above this one.
//   constructor(@Optional() @SkipSelf() parent: CoreModule) {
//     if (parent) throw new Error('CoreModule is already loaded');
//   }
// The inject() equivalents are an options object, not stacked decorators:
export class NewStyle {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly logger = inject(LoggerService, { optional: true });
  private readonly ownOnly = inject(Config, { self: true });
  private readonly fromParent = inject(Theme, { skipSelf: true });
  private readonly guard = inject(CoreThing, { optional: true, skipSelf: true });
}
// The real win is INHERITANCE. Constructor injection forces every subclass
// to repeat the parameters and call super() with them:
//   export abstract class Base {
//     constructor(protected http: HttpClient, protected router: Router) {}
//   }
//   export class UserList extends Base {
//     constructor(http: HttpClient, router: Router, private users: UserService) {
//       super(http, router);            // and every subclass repeats this
//     }
//   }
export abstract class Base {
  protected readonly http = inject(HttpClient);      // add one here and
  protected readonly router = inject(Router);        // no subclass changes
}
export class UserList extends Base {
  private readonly users = inject(UserService);      // no constructor at all
}
// Migrate with:  ng generate @angular/core:inject
// Check afterwards: field initialisers run BEFORE the constructor body,
// so verify the ordering if the constructor did real work.
</code></pre>
