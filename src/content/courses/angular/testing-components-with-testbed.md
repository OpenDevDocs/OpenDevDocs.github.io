---
publishDate: 2026-06-25T12:45
title: Testing Components with TestBed
slug: testing-components-with-testbed
metadescription: Test Angular components properly, set inputs, trigger events, replace child components and assert on what users see.
updateDate: 2026-09-07T12:45
author: ['bishal-biswas']
level: 3
tags: ['testing', 'testbed', 'components']
course: angular
---

## The basic shape

```typescript
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

describe('UserCard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UserCard],
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('shows the user name', async () => {
    const fixture = TestBed.createComponent(UserCard);
    fixture.componentRef.setInput('user', { id: 1, name: 'Asha' });

    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Asha');
  });
});
```

Standalone components go in `imports`, never `declarations`. That is the change people most often miss when migrating tests.

## Setting inputs

```typescript
fixture.componentRef.setInput('user', { id: 1, name: 'Asha' });
fixture.componentRef.setInput('compact', true);
```

`setInput` is the correct way. It goes through Angular's binding, so signal inputs update and `computed` values recalculate.

Assigning to the instance does not work with signal inputs:

```typescript
// wrong for a signal input
fixture.componentInstance.user = { id: 1, name: 'Asha' };
```

## Reading the rendered output

```typescript
const element: HTMLElement = fixture.nativeElement;

element.textContent;
element.querySelector('h3')?.textContent;
element.querySelectorAll('li').length;
element.querySelector('button')?.hasAttribute('disabled');
```

`DebugElement` is the older API and still works:

```typescript
import { By } from '@angular/platform-browser';

const heading = fixture.debugElement.query(By.css('h3'));
expect(heading.nativeElement.textContent).toBe('Asha');

const child = fixture.debugElement.query(By.directive(UserAvatar));
expect(child.componentInstance.name()).toBe('Asha');
```

`By.directive` is genuinely useful for reaching a child component instance. For everything else, plain DOM queries are simpler.

## Query by what users see

```typescript
// brittle: breaks on any restyle
element.querySelector('.btn-primary-lg')

// better: a stable test hook
element.querySelector('[data-testid="save-button"]')

// best where it fits: how a user finds it
[...element.querySelectorAll('button')].find(b => b.textContent?.includes('Save'))
```

Querying by CSS class couples tests to styling. Add `data-testid` for elements a test needs to find reliably, and prefer accessible text and roles where they are unambiguous.

## Triggering events

```typescript
it('emits when clicked', async () => {
  const fixture = TestBed.createComponent(UserCard);
  fixture.componentRef.setInput('user', { id: 1, name: 'Asha' });
  await fixture.whenStable();

  let emitted: number | undefined;
  fixture.componentInstance.deleted.subscribe(id => { emitted = id; });

  fixture.nativeElement.querySelector('[data-testid="delete"]').click();
  await fixture.whenStable();

  expect(emitted).toBe(1);
});
```

For form inputs, set the value then dispatch the event:

```typescript
const input: HTMLInputElement = fixture.nativeElement.querySelector('input');

input.value = 'Asha';
input.dispatchEvent(new Event('input'));

await fixture.whenStable();
```

Setting `value` alone changes nothing, because Angular listens for the event rather than watching the property.

## Change detection

```typescript
await fixture.whenStable();      // zoneless, and the modern default
fixture.detectChanges();          // synchronous, with Zone.js
```

In a zoneless test, `whenStable()` waits for signal updates and pending work to settle. It is the one to reach for.

`autoDetectChanges()` is worth knowing for tests that would otherwise need many manual calls:

```typescript
fixture.autoDetectChanges();
```

## Replacing child components

A component under test often renders children that fetch data or do heavy work. Replace them.

```typescript
@Component({
  selector: 'app-user-avatar',
  template: `<span data-testid="fake-avatar">{{ name() }}</span>`,
})
class FakeUserAvatar {
  readonly name = input('');
}

TestBed.configureTestingModule({
  imports: [UserCard],
})
  .overrideComponent(UserCard, {
    remove: { imports: [UserAvatar] },
    add: { imports: [FakeUserAvatar] },
  });
```

The fake must have the **same selector** and matching inputs, or the template will not compile.

Often simpler: provide a fake for the service the child depends on, and let the real child render.

## Testing with the router

```typescript
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

it('renders the user detail route', async () => {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: 'users/:id', component: UserDetail }]),
    ],
  });

  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl('/users/42', UserDetail);

  expect(component.id()).toBe('42');
});
```

`RouterTestingHarness` runs a real navigation, so guards, resolvers and input binding all behave as they do in the application.

## Testing signals directly

```typescript
it('computes the total', () => {
  const fixture = TestBed.createComponent(Cart);
  const component = fixture.componentInstance;

  fixture.componentRef.setInput('items', [{ price: 10 }, { price: 32 }]);

  expect(component.total()).toBe(42);
});
```

No rendering needed. Reading a computed signal is enough, and it is much faster than asserting on the DOM.

Test the logic through signals and the rendering separately, rather than doing both in every test.

## Component harnesses

For a reusable component, a harness gives tests a stable interface.

```typescript
import { ComponentHarness } from '@angular/cdk/testing';

export class UserCardHarness extends ComponentHarness {
  static hostSelector = 'app-user-card';

  private readonly deleteButton = this.locatorFor('[data-testid="delete"]');

  async getName(): Promise<string> {
    return (await this.locatorFor('h3')()).text();
  }

  async delete(): Promise<void> {
    await (await this.deleteButton()).click();
  }
}
```

```typescript
const loader = TestbedHarnessEnvironment.loader(fixture);
const card = await loader.getHarness(UserCardHarness);

expect(await card.getName()).toBe('Asha');
await card.delete();
```

The markup can change completely and the tests keep working, because they go through the harness. Angular Material ships harnesses for all its components for exactly this reason.

## What to test

**Test:** what renders for a given input, what happens on interaction, what is emitted, and conditional rendering.

**Do not test:** that Angular binds properly, exact CSS classes, or the internal structure of the DOM.

A useful check: would this test fail if the component were rewritten with the same behaviour but different markup? If yes, it is testing the implementation rather than the behaviour.

## Common problems

**Nothing renders.** A missing `await fixture.whenStable()`.

**A signal input does not update.** Assigning to the instance instead of using `setInput`.

**"NG0304: not a known element".** A child component is missing from `imports`.

**Flaky timing.** Real timers in a test. Use `fakeAsync` and `tick`, or a fake service.

## Quick recap

- Standalone components go in `imports`, not `declarations`.
- Use `componentRef.setInput()`, since assigning to the instance does not update signal inputs.
- `await fixture.whenStable()` is the zoneless replacement for `detectChanges()`.
- Set an input's value **and** dispatch the event, or Angular does not notice.
- Query by `data-testid` or accessible text rather than styling classes.
- `RouterTestingHarness` tests real navigation including guards and resolvers.
- Test logic through signals and rendering separately.

<code id="code-content" class="language-typescript">
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
describe('UserCard', () =&gt; {
  beforeEach(() =&gt; {
    TestBed.configureTestingModule({
      imports: [UserCard],          // standalone goes in IMPORTS, not declarations
      providers: [provideZonelessChangeDetection()],
    });
  });
  it('shows the name and emits on delete', async () =&gt; {
    const fixture = TestBed.createComponent(UserCard);
    // setInput goes through Angular's binding, so SIGNAL inputs update.
    // Assigning to componentInstance does NOT work for signal inputs.
    fixture.componentRef.setInput('user', { id: 1, name: 'Asha' });
    await fixture.whenStable();     // replaces detectChanges() when zoneless
    // Query by a stable test hook, not by a styling class
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Asha');
    let emitted: number | undefined;
    fixture.componentInstance.deleted.subscribe(id =&gt; { emitted = id; });
    element.querySelector&lt;HTMLButtonElement&gt;('[data-testid="delete"]')!.click();
    await fixture.whenStable();
    expect(emitted).toBe(1);
  });
  it('reads a form input', async () =&gt; {
    const fixture = TestBed.createComponent(UserCard);
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = 'Asha';
    // Setting .value alone changes NOTHING. Angular listens for the event.
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  });
  it('tests logic through signals, with no rendering at all', () =&gt; {
    const fixture = TestBed.createComponent(UserCard);
    fixture.componentRef.setInput('items', [{ price: 10 }, { price: 32 }]);
    expect(fixture.componentInstance.total()).toBe(42);   // much faster
  });
});
// Replacing a heavy child. The fake needs the SAME selector and inputs.
@Component({ selector: 'app-user-avatar', template: `&lt;span&gt;{{ name() }}&lt;/span&gt;` })
class FakeAvatar { readonly name = input(''); }
// TestBed.configureTestingModule({ imports: [UserCard] })
//   .overrideComponent(UserCard, {
//     remove: { imports: [UserAvatar] },
//     add: { imports: [FakeAvatar] },
//   });
// Real navigation, including guards, resolvers and input binding
// const harness = await RouterTestingHarness.create();
// const component = await harness.navigateByUrl('/users/42', UserDetail);
// expect(component.id()).toBe('42');
// THE USEFUL CHECK: would this test fail if the component were rewritten
// with the SAME behaviour but different markup? If yes, it is testing the
// implementation rather than the behaviour.
// Common problems:
//   nothing renders            a missing await fixture.whenStable()
//   signal input not updating  assigned to the instance instead of setInput
//   NG0304 unknown element     a child missing from imports
</code></pre>
