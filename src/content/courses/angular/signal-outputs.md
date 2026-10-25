---
publishDate: 2026-06-06T07:30
title: Outputs with output()
slug: signal-outputs
metadescription: Emit events from a component with output(), type the payload, and connect outputs to observables when you need to.
updateDate: 2026-09-07T07:30
author: ['bishal-biswas']
level: 1
tags: ['signals', 'outputs', 'components']
course: angular
---

## Sending events up

Inputs flow down. Outputs flow up.

```typescript
import { Component, output } from '@angular/core';

@Component({
  selector: 'app-search-box',
  template: `
    <input #box (keyup.enter)="search.emit(box.value)">
    <button (click)="cleared.emit()">Clear</button>
  `,
})
export class SearchBox {
  readonly search = output<string>();
  readonly cleared = output<void>();
}
```

```html
<app-search-box (search)="runSearch($event)" (cleared)="reset()" />
```

`$event` is whatever was emitted, typed as `string` here. Getting that type wrong is a compile error.

## Declaring outputs

```typescript
readonly saved = output<User>();          // emits a User
readonly closed = output<void>();         // emits nothing
readonly changed = output<number>();      // emits a number
readonly picked = output<{ id: number; name: string }>();
```

`output<void>()` is emitted with no argument:

```typescript
this.closed.emit();
```

## Aliasing

```typescript
readonly valueChanged = output<string>({ alias: 'change' });
```

```html
<app-input (change)="onChange($event)" />
```

Be careful aliasing to a native DOM event name. `change` on a component that wraps an `<input>` can be confusing, since the native event may also bubble.

## Despite the name, outputs are not signals

`output()` returns an `OutputEmitterRef`, not a signal. It has one method, `emit`.

```typescript
readonly saved = output<User>();

save(): void {
  this.saved.emit(this.user());
}
```

You cannot read an output's "current value", because there is no such thing. It is a stream of moments, not a value.

That is the right model. State belongs in signals, events belong in outputs.

## What changed from at-Output

```typescript
// old
@Output() saved = new EventEmitter<User>();
@Output('change') valueChanged = new EventEmitter<string>();
```

```typescript
// new
readonly saved = output<User>();
readonly valueChanged = output<string>({ alias: 'change' });
```

The differences that matter:

**No `EventEmitter` import.** `EventEmitter` extended RxJS `Subject`, which meant an output could be subscribed to, completed or errored from outside. Nobody needed that, and it caused confusion.

**Automatic cleanup.** Subscriptions are removed when the component is destroyed.

**Better types**, including proper handling of `void`.

`@Output()` still works. Migrate with:

```bash
ng generate @angular/core:output-migration
```

## Subscribing in code

Usually you bind in a template. When you need to listen from a parent class, `subscribe` works and returns something you can unsubscribe.

```typescript
export class Parent {
  private readonly child = viewChild.required(SearchBox);

  constructor() {
    effect(cleanup => {
      const subscription = this.child().search.subscribe(term => {
        console.log(term);
      });

      cleanup(() => subscription.unsubscribe());
    });
  }
}
```

Cleaner in most cases: bind in the template and let Angular handle it.

## Converting to and from observables

```typescript
import { outputToObservable, outputFromObservable } from '@angular/core/rxjs-interop';

export class SearchBox {
  readonly search = output<string>();

  readonly search$ = outputToObservable(this.search);
}
```

The reverse is more useful. It turns an observable into an output, which is how you expose a debounced stream:

```typescript
import { outputFromObservable, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

export class SearchBox {
  protected readonly term = signal('');

  readonly search = outputFromObservable(
    toObservable(this.term).pipe(
      debounceTime(300),
      distinctUntilChanged(),
    )
  );
}
```

```html
<app-search-box (search)="runSearch($event)" />
```

The parent sees a plain output. The debouncing is the child's business.

## Outputs or a shared service?

Outputs are for a **direct parent** to hear about something in its child. They do not travel further.

```html
<!-- fine -->
<app-child (saved)="onSaved($event)" />

<!-- awkward: passing an event up three levels -->
<app-a (saved)="b.emit($event)" />
```

Passing an event through several layers means a shared service is the better tool.

```typescript
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messagesState = signal<string[]>([]);
  readonly messages = this.messagesState.asReadonly();

  notify(message: string): void {
    this.messagesState.update(list => [...list, message]);
  }
}
```

Any component can call `notify`, and any component can read `messages`. No chain of outputs.

## Naming

Angular convention is that an output is named for **what happened**, in the past tense, without an `on` prefix.

```typescript
readonly saved = output<User>();       // good
readonly deleted = output<number>();   // good
readonly onSave = output<User>();      // avoid, the prefix belongs to the listener
```

The listener is where `on` belongs:

```html
<app-form (saved)="onSaved($event)" />
```

For two-way binding, the output must be the input's name plus `Change`:

```typescript
readonly value = input(0);
readonly valueChange = output<number>();
```

That enables `[(value)]`. `model()` creates both for you, which is usually easier.

## Common mistakes

**Emitting on every keystroke** without debouncing, causing a request per character. Debounce in the child with `outputFromObservable`, or in the parent.

**Emitting an object the parent then mutates.** Emit a copy, or a plain value.

**Using an output where an input would do.** If the parent already owns the state, pass a callback in as an input, or better, let the parent own the handler and the child just emit.

## Quick recap

- `output<T>()` declares an event, and `emit(value)` fires it.
- `$event` in the template is the emitted value, fully typed.
- Outputs are not signals, they have no current value, only `emit`.
- `output()` replaced `EventEmitter`, with automatic cleanup and better types.
- `outputFromObservable` exposes a debounced or transformed stream as a plain output.
- Outputs reach the direct parent only. Use a shared service for anything further.
- Name outputs in the past tense, and pair `value` with `valueChange` for two-way binding.

<code id="code-content" class="language-typescript">
import { Component, output, input, signal, viewChild, effect } from '@angular/core';
import { outputFromObservable, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
@Component({
  selector: 'app-search-box',
  template: `
    &lt;input #box (input)="term.set(box.value)" (keyup.enter)="submitted.emit(box.value)"&gt;
    &lt;button (click)="cleared.emit()"&gt;Clear&lt;/button&gt;
  `,
})
export class SearchBox {
  // Named for WHAT HAPPENED, past tense, no `on` prefix
  readonly submitted = output&lt;string&gt;();
  readonly cleared = output&lt;void&gt;();          // emit() with no argument
  protected readonly term = signal('');
  // Expose a DEBOUNCED stream as a plain output. The parent sees an ordinary event.
  readonly search = outputFromObservable(
    toObservable(this.term).pipe(debounceTime(300), distinctUntilChanged()));
}
// Used like any other event. $event is typed as string.
//   &lt;app-search-box (search)="runSearch($event)" (cleared)="reset()" /&gt;
// output() is NOT a signal. There is no current value, only emit().
// It replaced @Output() saved = new EventEmitter&lt;User&gt;()
//   - no EventEmitter import, which used to leak a whole RxJS Subject
//   - subscriptions are cleaned up automatically
//   - proper void handling
// For two-way binding the output must be the input name plus Change:
@Component({ selector: 'app-stepper', template: `` })
export class Stepper {
  readonly value = input(0);
  readonly valueChange = output&lt;number&gt;();     // enables [(value)]
  // model(0) creates both of these for you, which is usually easier
}
// Outputs reach the DIRECT PARENT only. Passing an event up three levels
// means you want a shared service instead:
//   @Injectable({ providedIn: 'root' })
//   export class Notifications {
//     private readonly state = signal&lt;string[]&gt;([]);
//     readonly messages = this.state.asReadonly();
//     notify(m: string) { this.state.update(l =&gt; [...l, m]); }
//   }
// Migrate with:  ng generate @angular/core:output-migration
</code></pre>
