---
publishDate: 2026-06-28T13:25
title: Dynamic Components and ViewContainerRef
slug: dynamic-components
metadescription: Create components at runtime with ViewContainerRef, pass inputs, listen to outputs and clean them up properly.
updateDate: 2026-09-07T13:25
author: ['bishal-biswas']
level: 4
tags: ['dynamic components', 'viewcontainerref', 'advanced']
course: angular
---

## When the template cannot say it

Most of the time you know what to render, so `@if` and `@switch` are enough. Occasionally you do not: a dashboard built from user configuration, a form generated from a schema, a dialog service that renders whatever it is given.

`ViewContainerRef.createComponent` builds a component at runtime.

```typescript
import { Component, ViewContainerRef, inject, viewChild } from '@angular/core';

@Component({
  selector: 'app-host',
  template: `
    <ng-container #slot />
    <button (click)="load()">Load</button>
  `,
})
export class Host {
  private readonly slot = viewChild.required('slot', { read: ViewContainerRef });

  protected async load(): Promise<void> {
    const { HeavyChart } = await import('./heavy-chart');

    this.slot().clear();

    const ref = this.slot().createComponent(HeavyChart);

    ref.setInput('data', this.data());
  }
}
```

`ng-container` with `read: ViewContainerRef` gives you an insertion point that adds no element to the DOM.

## Setting inputs

```typescript
const ref = container.createComponent(UserCard);

ref.setInput('user', { id: 1, name: 'Asha' });
ref.setInput('compact', true);
```

`setInput` goes through Angular's binding, so signal inputs update and computed values recalculate. Assigning to `ref.instance` bypasses that and does not work with signal inputs.

```typescript
ref.instance.user = { id: 1 };    // does not update a signal input
ref.setInput('user', { id: 1 });   // correct
```

Calling `setInput` again later updates the component, so a dynamic component can be driven over time.

## Listening to outputs

```typescript
const ref = container.createComponent(UserCard);

const subscription = ref.instance.deleted.subscribe(id => {
  this.remove(id);
});

ref.onDestroy(() => subscription.unsubscribe());
```

Outputs are reached through `instance`. There is no binding syntax, so you subscribe manually and clean up manually.

`ref.onDestroy` is the tidy place for that cleanup.

## Cleaning up

```typescript
ref.destroy();          // destroy one component
container.clear();      // destroy everything in the container
```

Dynamic components are **not** cleaned up automatically. Forgetting to destroy them is a genuine memory leak, and the usual cause is replacing content without clearing first.

```typescript
// leaks: the previous component stays alive
this.slot().createComponent(NextComponent);

// correct
this.slot().clear();
this.slot().createComponent(NextComponent);
```

## Providing dependencies

```typescript
const ref = container.createComponent(WidgetComponent, {
  injector: Injector.create({
    providers: [
      { provide: WIDGET_CONFIG, useValue: config },
    ],
    parent: this.injector,
  }),
});
```

`parent` matters. Without it the new injector has nothing above it, so the component cannot reach application wide services.

## Projecting content

```typescript
const ref = container.createComponent(DialogComponent, {
  projectableNodes: [
    [this.document.createTextNode('Are you sure?')],
  ],
});
```

`projectableNodes` is an array of arrays, one per `ng-content` slot in order. Fiddly, and usually a sign that a `TemplateRef` would fit better.

## A dialog service

The most common real use.

```typescript
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);

  open<T, R>(component: Type<T>, data?: unknown): Promise<R | undefined> {
    return new Promise(resolve => {
      const host = this.document.createElement('div');
      host.className = 'dialog-host';
      this.document.body.appendChild(host);

      const ref = createComponent(component, {
        environmentInjector: this.injector,
        hostElement: host,
      });

      if (data !== undefined) ref.setInput('data', data);

      const close = (result?: R) => {
        this.appRef.detachView(ref.hostView);
        ref.destroy();
        host.remove();
        resolve(result);
      };

      const instance = ref.instance as { closed?: OutputEmitterRef<R> };
      instance.closed?.subscribe(close);

      this.appRef.attachView(ref.hostView);
    });
  }
}
```

`createComponent` with `hostElement` renders into an element you control, which is how you escape the component tree and append to `document.body`.

`appRef.attachView` is essential. Without it the component is created but never included in change detection, so it renders once and then never updates.

The CDK's `Overlay` does all of this properly, including positioning, backdrops, focus trapping and scroll blocking. Use it rather than this unless you have a specific reason.

## Deciding at runtime

```typescript
@Injectable({ providedIn: 'root' })
export class WidgetRegistry {
  private readonly loaders: Record<string, () => Promise<Type<unknown>>> = {
    chart: () => import('./widgets/chart').then(m => m.ChartWidget),
    table: () => import('./widgets/table').then(m => m.TableWidget),
    map: () => import('./widgets/map').then(m => m.MapWidget),
  };

  load(type: string): Promise<Type<unknown>> {
    const loader = this.loaders[type];

    if (!loader) throw new Error(`Unknown widget type: ${type}`);

    return loader();
  }
}
```

```typescript
export class Dashboard {
  private readonly slot = viewChild.required('slot', { read: ViewContainerRef });
  private readonly registry = inject(WidgetRegistry);

  readonly widgets = input.required<WidgetConfig[]>();

  constructor() {
    effect(async () => {
      const configs = this.widgets();
      const container = this.slot();

      container.clear();

      for (const config of configs) {
        const type = await this.registry.load(config.type);
        const ref = container.createComponent(type);
        ref.setInput('config', config);
      }
    });
  }
}
```

Each widget type is its own lazy chunk, so a dashboard only downloads the widgets it actually uses.

## Prefer NgComponentOutlet

For the common case there is a declarative alternative, and it handles cleanup for you.

```typescript
import { NgComponentOutlet } from '@angular/common';

@Component({
  imports: [NgComponentOutlet],
  template: `
    <ng-container
      *ngComponentOutlet="currentComponent(); inputs: currentInputs()" />
  `,
})
export class Host {
  protected readonly currentComponent = signal<Type<unknown>>(DefaultView);
  protected readonly currentInputs = signal<Record<string, unknown>>({});
}
```

No manual creation, no manual destruction, no leak. **Reach for this first**, and use `ViewContainerRef` only when you need control it cannot give: several instances, precise ordering, or dependency injection per instance.

## Common mistakes

**Not clearing before creating.** The old component stays alive and keeps its subscriptions.

**Assigning to `ref.instance` for inputs.** Signal inputs do not update.

**Forgetting `attachView`** when creating outside the component tree. It renders once and then goes stale.

**Not unsubscribing from outputs.** Use `ref.onDestroy`.

**Creating in an effect without cleanup.** The effect reruns, creating another instance each time.

## Quick recap

- `ViewContainerRef.createComponent` builds a component at runtime.
- Use `ng-container` with `read: ViewContainerRef` for an insertion point.
- Use `ref.setInput()`, not `ref.instance.x`, or signal inputs do not update.
- Subscribe to outputs through `instance`, and clean up in `ref.onDestroy`.
- Always `clear()` before creating a replacement, or you leak.
- Creating outside the component tree needs `appRef.attachView`.
- Prefer `NgComponentOutlet`, and use the CDK overlay for dialogs.

<code id="code-content" class="language-typescript">
import { Component, Injectable, Injector, EnvironmentInjector, ViewContainerRef,
         ApplicationRef, Type, inject, input, signal, effect, viewChild,
         createComponent, DOCUMENT } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
// PREFER THIS. Declarative, and cleanup is handled for you.
@Component({
  selector: 'app-simple-host',
  imports: [NgComponentOutlet],
  template: `&lt;ng-container *ngComponentOutlet="current(); inputs: inputs()" /&gt;`,
})
export class SimpleHost {
  protected readonly current = signal&lt;Type&lt;unknown&gt;&gt;(DefaultView);
  protected readonly inputs = signal&lt;Record&lt;string, unknown&gt;&gt;({});
}
// Use ViewContainerRef only when you need control NgComponentOutlet cannot
// give: several instances, precise ordering, or per instance injection.
@Component({
  selector: 'app-dashboard',
  template: `&lt;ng-container #slot /&gt;`,     // adds no element to the DOM
})
export class Dashboard {
  private readonly slot = viewChild.required('slot', { read: ViewContainerRef });
  private readonly injector = inject(Injector);
  readonly widgets = input.required&lt;{ type: string }[]&gt;();
  constructor() {
    effect(async () =&gt; {
      const container = this.slot();
      container.clear();          // WITHOUT THIS the old components leak
      for (const config of this.widgets()) {
        const type = await this.load(config.type);
        const ref = container.createComponent(type, {
          // parent matters: without it the component cannot reach
          // application wide services
          injector: Injector.create({ providers: [], parent: this.injector }),
        });
        // setInput goes through Angular's binding, so SIGNAL inputs update.
        // ref.instance.config = ... does NOT.
        ref.setInput('config', config);
        // Outputs are reached through instance, with manual cleanup
        const instance = ref.instance as { removed?: { subscribe: Function } };
        const sub = instance.removed?.subscribe(() =&gt; ref.destroy());
        ref.onDestroy(() =&gt; sub?.unsubscribe?.());
      }
    });
  }
  // Each widget type is its own lazy chunk
  private load(type: string): Promise&lt;Type&lt;unknown&gt;&gt; {
    const loaders: Record&lt;string, () =&gt; Promise&lt;Type&lt;unknown&gt;&gt;&gt; = {
      chart: () =&gt; import('./widgets/chart').then(m =&gt; m.ChartWidget),
      table: () =&gt; import('./widgets/table').then(m =&gt; m.TableWidget),
    };
    return loaders[type]();
  }
}
// Rendering OUTSIDE the component tree, e.g. appending to document.body
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  open&lt;T&gt;(component: Type&lt;T&gt;): void {
    const host = this.document.createElement('div');
    this.document.body.appendChild(host);
    const ref = createComponent(component, {
      environmentInjector: this.injector,
      hostElement: host,
    });
    // ESSENTIAL. Without it the component renders once and then never
    // updates, because it is not part of change detection.
    this.appRef.attachView(ref.hostView);
    ref.onDestroy(() =&gt; { this.appRef.detachView(ref.hostView); host.remove(); });
  }
}
// The CDK Overlay does all of this properly, with positioning, backdrops,
// focus trapping and scroll blocking. Use it for real dialogs.
</code></pre>
