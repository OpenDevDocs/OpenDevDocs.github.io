---
publishDate: 2026-06-25T12:40
title: Unit Testing with Vitest
slug: unit-testing-with-vitest
metadescription: Run Angular unit tests with Vitest, the default runner for new projects, and migrate an existing Karma setup.
updateDate: 2026-09-07T12:40
author: ['bishal-biswas']
level: 3
tags: ['testing', 'vitest', 'tooling']
course: angular
---

## The runner changed

Angular used Karma and Jasmine for a decade. Karma was deprecated in 2023, and after evaluating the alternatives the team settled on **Vitest**, which became stable in Angular 21 and is now the default for new projects.

Karma and Jasmine are still fully supported. There is no deadline, and existing projects work.

```bash
ng test
```

That is the command in both cases. What runs underneath depends on how the project is configured.

## What Vitest gives you

**Speed.** Tests run in a Node environment with a fast transform pipeline, rather than launching and driving a real browser for every run. A suite that took minutes under Karma often takes seconds.

**A better watch mode.** It reruns only the tests affected by a change.

**Modern module handling.** ES modules work without the bundling contortions Karma needed.

**One tool.** Vitest handles the running, assertions, mocking and coverage. Karma needed Jasmine for assertions and a separate coverage plugin.

## A test

```typescript
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { Counter } from './counter';

describe('Counter', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Counter],
    });
  });

  it('starts at zero', async () => {
    const fixture = TestBed.createComponent(Counter);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('0');
  });

  it('increments when clicked', async () => {
    const fixture = TestBed.createComponent(Counter);
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('1');
  });
});
```

The Angular parts are unchanged. `TestBed`, `createComponent` and `whenStable` work exactly as before. Only the assertion library and the runner differ.

The imports from `vitest` are optional if globals are enabled, which the default configuration does.

## Jasmine to Vitest

The differences are mostly mechanical.

```typescript
// spies
jasmine.createSpy('name')                    vi.fn()
jasmine.createSpyObj('svc', ['get'])         { get: vi.fn() }
spyOn(service, 'load')                       vi.spyOn(service, 'load')
spy.and.returnValue(x)                       spy.mockReturnValue(x)
spy.and.callFake(fn)                         spy.mockImplementation(fn)
spy.and.throwError('x')                      spy.mockImplementation(() => { throw new Error('x'); })

// assertions
expect(x).toBe(y)                            same
expect(x).toEqual(y)                         same
expect(spy).toHaveBeenCalled()               same
expect(spy).toHaveBeenCalledWith(a)          same
expect(x).toBeTruthy()                       same

// timers
jasmine.clock().install()                    vi.useFakeTimers()
jasmine.clock().tick(100)                    vi.advanceTimersByTime(100)
jasmine.clock().uninstall()                  vi.useRealTimers()

// lifecycle
beforeEach / afterEach                       same
beforeAll / afterAll                         same
```

Most assertions are identical, because Vitest deliberately follows the same style.

## Mocking a module

```typescript
import { vi } from 'vitest';

vi.mock('./analytics', () => ({
  track: vi.fn(),
}));
```

Jasmine had no equivalent, so people worked around it with dependency injection. In Angular that is still the better approach:

```typescript
TestBed.configureTestingModule({
  providers: [
    { provide: AnalyticsService, useValue: { track: vi.fn() } },
  ],
});
```

Prefer providing a fake through the injector. Module mocking couples the test to import paths, which makes refactoring painful.

## Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 70,
      },
    },
  },
});
```

`environment: 'jsdom'` gives a simulated DOM in Node. It covers nearly everything, but it is not a real browser, so layout measurement and some APIs behave differently.

For tests that genuinely need a browser, Vitest can run in one:

```typescript
test: {
  browser: {
    enabled: true,
    provider: 'playwright',
    instances: [{ browser: 'chromium' }],
  },
}
```

Slower, and worth it for component tests that depend on real layout.

## Zoneless tests

```typescript
import { provideZonelessChangeDetection } from '@angular/core';

TestBed.configureTestingModule({
  providers: [provideZonelessChangeDetection()],
});
```

```typescript
it('updates after a click', async () => {
  const fixture = TestBed.createComponent(Counter);
  await fixture.whenStable();

  fixture.nativeElement.querySelector('button').click();
  await fixture.whenStable();

  expect(fixture.nativeElement.textContent).toContain('1');
});
```

`await fixture.whenStable()` replaces `fixture.detectChanges()`. Signal updates settle without `fakeAsync` or `tick`.

`fakeAsync` still works and is still right for real timers:

```typescript
it('debounces', fakeAsync(() => {
  component.search('a');
  tick(300);

  expect(service.query).toHaveBeenCalledOnce();
}));
```

## Migrating an existing project

```bash
ng generate @schematics/angular:refactor-tests-to-vitest
```

The migration is **experimental**. It updates the configuration, converts Jasmine spies and adjusts the imports.

Expect to fix things by hand afterwards:

**`done` callbacks.** Vitest supports them, but async and await is clearer and less error prone.

**Custom Jasmine matchers.** These need rewriting with `expect.extend`.

**`jasmine.any` and `jasmine.objectContaining`.** These become `expect.any` and `expect.objectContaining`.

**Karma specific configuration.** `karma.conf.js` and its plugins can be deleted once everything passes.

**Browser only assumptions.** Tests relying on real layout may fail under jsdom.

Migrate one folder at a time if the suite is large. Both runners cannot run at once, so it is a single switch, but fixing failures incrementally is easier than facing all of them.

## Running tests

```bash
ng test                          # watch mode
ng test --watch=false            # a single run, for CI
ng test --coverage
ng test --reporters=verbose
```

Vitest's own CLI works too once configured, which is useful for filtering:

```bash
npx vitest run src/app/user
npx vitest run -t "increments"
```

## What to test

**Services.** The highest value per line. Pure logic, no DOM, fast.

**Pipes.** Plain classes, so no `TestBed` needed at all.

**Component behaviour.** What renders for a given state, and what happens on interaction.

**Guards, resolvers and interceptors.** Small functions with clear inputs and outputs.

What not to test: Angular itself, exact markup, or CSS. A test asserting a specific class name breaks on every restyle and catches nothing.

## Quick recap

- Vitest is the default runner for new projects and stable since Angular 21.
- Karma and Jasmine are deprecated but still fully supported.
- `TestBed`, `createComponent` and `whenStable` are unchanged.
- Jasmine spies become `vi.fn()` and `vi.spyOn()`, and most assertions are identical.
- Prefer providing fakes through the injector over mocking modules.
- Use `await fixture.whenStable()` rather than `detectChanges()` in zoneless tests.
- The Karma migration schematic is experimental, so expect some manual fixes.

<code id="code-content" class="language-typescript">
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
describe('Counter', () =&gt; {
  beforeEach(() =&gt; {
    TestBed.configureTestingModule({
      imports: [Counter],                     // standalone components go in imports
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        // Prefer providing a FAKE through the injector over vi.mock().
        // Module mocking couples the test to import paths.
        { provide: AnalyticsService, useValue: { track: vi.fn() } },
      ],
    });
  });
  it('increments when clicked', async () =&gt; {
    const fixture = TestBed.createComponent(Counter);
    // whenStable() replaces detectChanges(). Signal updates settle
    // without fakeAsync or tick.
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('1');
  });
});
// JASMINE -&gt; VITEST. Mostly mechanical, and most assertions are identical.
//   jasmine.createSpy()             vi.fn()
//   jasmine.createSpyObj('s',['a']) { a: vi.fn() }
//   spyOn(svc, 'load')              vi.spyOn(svc, 'load')
//   spy.and.returnValue(x)          spy.mockReturnValue(x)
//   spy.and.callFake(fn)            spy.mockImplementation(fn)
//   jasmine.clock().tick(100)       vi.advanceTimersByTime(100)
//   jasmine.any(String)             expect.any(String)
//   jasmine.objectContaining({})    expect.objectContaining({})
// fakeAsync still works, and is still right for REAL timers:
//   it('debounces', fakeAsync(() =&gt; { component.search('a'); tick(300); }));
// vitest.config.ts
//   test: {
//     globals: true,
//     environment: 'jsdom',        // a simulated DOM, NOT a real browser
//     coverage: { provider: 'v8', thresholds: { statements: 80 } },
//     // for tests that genuinely need real layout:
//     // browser: { enabled: true, provider: 'playwright',
//     //            instances: [{ browser: 'chromium' }] },
//   }
// Migrating from Karma. EXPERIMENTAL, so expect manual fixes afterwards:
//   ng generate @schematics/angular:refactor-tests-to-vitest
// Then check: done callbacks, custom Jasmine matchers, and any test
// relying on real layout that jsdom cannot provide.
// ng test                 watch mode
// ng test --watch=false   single run, for CI
// ng test --coverage
</code></pre>
