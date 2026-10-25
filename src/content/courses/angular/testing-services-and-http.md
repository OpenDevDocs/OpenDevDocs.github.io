---
publishDate: 2026-06-26T12:50
title: Testing Services, HTTP and Signals
slug: testing-services-and-http
metadescription: Test services, HTTP calls, signals and resources, with fakes provided through the injector.
updateDate: 2026-09-07T12:50
author: ['bishal-biswas']
level: 3
tags: ['testing', 'services', 'http']
course: angular
---

## Services are the best value tests

A service test is fast, has no DOM and covers real logic. If you only write some tests, write these.

```typescript
describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  it('starts empty', () => {
    expect(service.items()).toEqual([]);
    expect(service.total()).toBe(0);
  });

  it('adds an item', () => {
    service.add({ productId: 1, price: 10, quantity: 2 });

    expect(service.items().length).toBe(1);
    expect(service.total()).toBe(20);
  });

  it('increases the quantity of an existing item', () => {
    service.add({ productId: 1, price: 10, quantity: 1 });
    service.add({ productId: 1, price: 10, quantity: 1 });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(2);
  });
});
```

`TestBed.inject` builds the service with its real dependencies, so `providedIn: 'root'` needs no registration.

Signals are read directly. No subscription, no `fakeAsync`, no rendering.

## Testing HTTP

```typescript
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

describe('UserService', () => {
  let service: UserService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(UserService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
  });

  it('requests the user list', () => {
    let result: User[] | undefined;

    service.getAll().subscribe(users => { result = users; });

    const request = controller.expectOne('/api/users');
    expect(request.request.method).toBe('GET');

    request.flush([{ id: 1, name: 'Asha' }]);

    expect(result?.length).toBe(1);
  });
});
```

`controller.verify()` in `afterEach` fails the test if any request went unhandled. It catches requests you did not expect, which is often more valuable than the assertions you wrote deliberately.

## Matching requests

```typescript
controller.expectOne('/api/users');
controller.expectOne({ method: 'POST', url: '/api/users' });
controller.expectOne(req => req.url.startsWith('/api/users'));
controller.expectNone('/api/admin');

const requests = controller.match('/api/users');
expect(requests.length).toBe(2);
```

Asserting on the request itself:

```typescript
const request = controller.expectOne('/api/users');

expect(request.request.body).toEqual({ name: 'Asha' });
expect(request.request.headers.get('Authorization')).toBe('Bearer token');
expect(request.request.params.get('page')).toBe('2');
```

## Testing errors

```typescript
it('reports a failure', () => {
  let error: unknown;

  service.getAll().subscribe({ error: e => { error = e; } });

  controller.expectOne('/api/users').flush(
    { message: 'Server error' },
    { status: 500, statusText: 'Internal Server Error' },
  );

  expect(error).toBeInstanceOf(HttpErrorResponse);
});
```

For a network failure rather than an error status:

```typescript
controller.expectOne('/api/users').error(new ProgressEvent('Network error'));
```

That produces status `0`, which is the case people forget to handle.

## Testing a resource

```typescript
it('loads the user', async () => {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });

  const fixture = TestBed.createComponent(UserDetail);
  fixture.componentRef.setInput('id', '42');

  await fixture.whenStable();

  const controller = TestBed.inject(HttpTestingController);
  controller.expectOne('/api/users/42').flush({ id: 42, name: 'Asha' });

  await fixture.whenStable();

  expect(fixture.componentInstance.user.value()?.name).toBe('Asha');
});
```

The first `whenStable()` lets the resource start its request. The second lets the response settle into the signal. Forgetting the second is the usual cause of a test seeing `undefined`.

## Providing fakes

```typescript
const fakeAuth = {
  isLoggedIn: vi.fn().mockReturnValue(true),
  roles: signal(['admin']),
  token: signal('test-token'),
};

TestBed.configureTestingModule({
  providers: [
    { provide: AuthService, useValue: fakeAuth },
  ],
});
```

Make signal returning members real signals, so anything computing from them behaves normally.

For a partial fake, cast rather than implementing the whole interface:

```typescript
const fake = { isLoggedIn: () => true } as unknown as AuthService;
```

## Testing guards and interceptors

Both need an injection context.

```typescript
it('redirects when signed out', () => {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isLoggedIn: () => false } },
    ],
  });

  const result = TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, { url: '/admin' } as RouterStateSnapshot)
  );

  expect(result).toBeInstanceOf(UrlTree);
});
```

An interceptor is tested through the real pipeline:

```typescript
it('adds the token', () => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { token: () => 'abc' } },
    ],
  });

  TestBed.inject(HttpClient).get('/api/data').subscribe();

  const request = TestBed.inject(HttpTestingController).expectOne('/api/data');
  expect(request.request.headers.get('Authorization')).toBe('Bearer abc');
});
```

## Testing effects

```typescript
it('writes the theme to storage', async () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem');

  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection()],
  });

  const service = TestBed.inject(SettingsService);
  service.setTheme('dark');

  await TestBed.inject(ApplicationRef).whenStable();

  expect(setItem).toHaveBeenCalledWith('theme', 'dark');
});
```

Effects run after change detection, so you must wait. Asserting immediately after `setTheme` finds nothing has happened yet.

## Testing a pipe

```typescript
describe('Truncate', () => {
  const pipe = new Truncate();

  it('leaves short strings alone', () => {
    expect(pipe.transform('short', 10)).toBe('short');
  });

  it('handles null', () => {
    expect(pipe.transform(null)).toBe('');
  });
});
```

A pipe with no dependencies needs no `TestBed` at all. Just construct it.

## What to test

Cover the branches, not the lines.

```text
the happy path
each error case
empty and boundary inputs
anything with an if in it
```

A service with a single `getAll()` that forwards to HTTP barely needs a test. A service that merges, caches and transforms deserves several.

## Quick recap

- Service tests are the best value, since they are fast and cover real logic.
- `controller.verify()` in `afterEach` catches unexpected requests.
- Use `flush()` for a response and `error()` for a network failure.
- Testing a resource needs two `whenStable()` calls: one to start, one to settle.
- Make fake signal members real signals so derived values behave.
- Guards and interceptors need `runInInjectionContext` or the real HTTP pipeline.
- Effects run after change detection, so await stability before asserting.

<code id="code-content" class="language-typescript">
import { TestBed } from '@angular/core/testing';
import { signal, ApplicationRef, provideZonelessChangeDetection, runInInjectionContext } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors, HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
describe('UserService', () =&gt; {
  let service: UserService;
  let controller: HttpTestingController;
  beforeEach(() =&gt; {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(), provideHttpClientTesting(),
        // Make fake signal members REAL signals so derived values work
        { provide: AuthService, useValue: {
            isLoggedIn: vi.fn().mockReturnValue(true),
            roles: signal(['admin']),
            token: signal('test-token'),
        } },
      ],
    });
    service = TestBed.inject(UserService);
    controller = TestBed.inject(HttpTestingController);
  });
  // Fails the test if ANY request went unhandled. Often catches more than
  // the assertions you wrote deliberately.
  afterEach(() =&gt; controller.verify());
  it('requests the list', () =&gt; {
    let result: User[] | undefined;
    service.getAll().subscribe(users =&gt; { result = users; });
    const request = controller.expectOne('/api/users');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([{ id: 1, name: 'Asha' }]);
    expect(result?.length).toBe(1);
  });
  it('handles a server error', () =&gt; {
    let error: unknown;
    service.getAll().subscribe({ error: e =&gt; { error = e; } });
    controller.expectOne('/api/users')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    expect(error).toBeInstanceOf(HttpErrorResponse);
  });
  it('handles a network failure', () =&gt; {
    service.getAll().subscribe({ error: () =&gt; {} });
    // status 0, the case people forget to handle
    controller.expectOne('/api/users').error(new ProgressEvent('Network error'));
  });
});
// Testing a RESOURCE needs TWO whenStable calls: one to start the request,
// one to let the response settle into the signal. Forgetting the second is
// the usual cause of a test seeing undefined.
//   await fixture.whenStable();
//   controller.expectOne('/api/users/42').flush({ id: 42, name: 'Asha' });
//   await fixture.whenStable();
//   expect(fixture.componentInstance.user.value()?.name).toBe('Asha');
// Guards need an injection context:
//   const result = TestBed.runInInjectionContext(() =&gt; authGuard(route, state));
// Interceptors are tested through the REAL pipeline:
//   provideHttpClient(withInterceptors([authInterceptor]))
// EFFECTS run after change detection, so await stability before asserting:
//   await TestBed.inject(ApplicationRef).whenStable();
// A pipe with no dependencies needs no TestBed. Just construct it.
//   const pipe = new Truncate();
//   expect(pipe.transform(null)).toBe('');
</code></pre>
