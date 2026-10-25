---
publishDate: 2026-06-08T08:05
title: Component Lifecycle Hooks
slug: component-lifecycle-hooks
metadescription: Learn the lifecycle hooks Angular still calls, which ones signals made unnecessary, and where each one genuinely belongs.
updateDate: 2026-09-07T08:05
author: ['bishal-biswas']
level: 2
tags: ['lifecycle', 'hooks', 'components']
course: angular
---

## The hooks

Angular calls these methods at fixed points in a component's life.

```text
ngOnChanges          an input changed
ngOnInit             after the first ngOnChanges, once
ngDoCheck            on every change detection run
ngAfterContentInit   projected content is ready, once
ngAfterContentChecked  projected content checked
ngAfterViewInit      the view and child views are ready, once
ngAfterViewChecked   the view checked
ngOnDestroy          before the component is removed
```

They still work and are not deprecated. But signals made most of them unnecessary, and modern Angular code uses very few.

## ngOnInit

The one you will still write occasionally.

```typescript
export class UserList implements OnInit {
  private readonly service = inject(UserService);
  protected readonly users = signal<User[]>([]);

  ngOnInit(): void {
    this.service.getAll().subscribe(users => this.users.set(users));
  }
}
```

Why not the constructor? Historically, because inputs were not set yet. That reason has weakened with signal inputs, since you read those inside `computed` or `effect` anyway.

The modern alternative is usually a resource:

```typescript
protected readonly users = httpResource<User[]>(() => '/api/users');
```

No hook at all, plus loading and error state for free.

## ngOnDestroy

For cleanup. Still relevant, though there is a better option.

```typescript
export class Poller implements OnDestroy {
  private readonly id = setInterval(() => this.check(), 1000);

  ngOnDestroy(): void {
    clearInterval(this.id);
  }
}
```

`DestroyRef` does the same without implementing an interface, and works in services and functions too:

```typescript
export class Poller {
  constructor() {
    const id = setInterval(() => this.check(), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
```

Better still, an effect with cleanup:

```typescript
constructor() {
  effect(onCleanup => {
    const id = setInterval(() => this.check(), this.interval());
    onCleanup(() => clearInterval(id));
  });
}
```

That handles both the interval changing and the component being destroyed.

For RxJS, `takeUntilDestroyed` removes the need for a hook entirely:

```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

constructor() {
  this.service.updates$
    .pipe(takeUntilDestroyed())
    .subscribe(update => this.handle(update));
}
```

## ngOnChanges

Runs whenever an input changes, with a record of what changed.

```typescript
export class Chart implements OnChanges {
  @Input() data: number[] = [];
  @Input() colour = 'blue';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.redraw();
    }
  }
}
```

With signal inputs this is unnecessary.

```typescript
export class Chart {
  readonly data = input.required<number[]>();
  readonly colour = input('blue');

  constructor() {
    effect(() => this.redraw(this.data()));    // only when data changes
  }

  protected readonly summary = computed(() => this.data().length);
}
```

The effect depends only on what it reads, so there is no `changes['data']` check. That string key was never type safe anyway.

**Do not mix them.** `ngOnChanges` does not fire reliably for signal inputs. Convert a component's inputs together.

## ngAfterViewInit

Ran when the view and child components existed. Used for DOM access and third party initialisation.

```typescript
export class Chart implements AfterViewInit {
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      new ThirdPartyChart(this.canvas.nativeElement);
    }
  }
}
```

Replaced by `afterNextRender`, which does not run on the server and has cleanup built in:

```typescript
export class Chart {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    afterNextRender(onCleanup => {
      const chart = new ThirdPartyChart(this.canvas().nativeElement);
      onCleanup(() => chart.destroy());
    });
  }
}
```

## ngAfterContentInit

For projected content. Replaced by `contentChild` and `contentChildren`, which are reactive.

```typescript
// old
@ContentChildren(Tab) tabs!: QueryList<Tab>;

ngAfterContentInit(): void {
  this.tabs.changes.subscribe(() => this.rebuild());
  this.rebuild();
}
```

```typescript
// new
readonly tabs = contentChildren(Tab);

protected readonly tabLabels = computed(() => this.tabs().map(t => t.label()));
```

## ngDoCheck and the Checked hooks

`ngDoCheck`, `ngAfterContentChecked` and `ngAfterViewChecked` run on **every** change detection pass, which can be hundreds of times a second.

They exist for custom change detection, such as noticing a mutation inside an object that Angular cannot see. That need mostly disappears with signals, where you replace values rather than mutate them.

Avoid them. Anything expensive in one is a guaranteed performance problem, and it is very easy to cause an infinite loop by changing state inside one.

## The order

For a parent with a child, on first render:

```text
parent  ngOnChanges
parent  ngOnInit
parent  ngDoCheck
parent  ngAfterContentInit
parent  ngAfterContentChecked
child   ngOnChanges
child   ngOnInit
child   ngDoCheck
child   ngAfterContentInit
child   ngAfterContentChecked
child   ngAfterViewInit
child   ngAfterViewChecked
parent  ngAfterViewInit
parent  ngAfterViewChecked
```

Two things matter. **Children initialise before the parent's view hooks**, which is why a parent can safely query its children in `ngAfterViewInit`. And **destruction runs parent first**, then children.

## Implement the interface

TypeScript does not require it, but implement the interface anyway.

```typescript
export class UserList implements OnInit, OnDestroy {
  ngOnInit(): void { ... }
  ngOnDestroy(): void { ... }
}
```

The compiler then catches a misspelt `ngOnint`, which otherwise fails silently at runtime.

## The modern equivalents

```text
ngOnChanges           ->  computed() or effect() on a signal input
ngOnInit              ->  a field initialiser, or httpResource
ngAfterViewInit       ->  afterNextRender
ngAfterContentInit    ->  contentChildren, which is reactive
ngAfterViewChecked    ->  afterRenderEffect
ngOnDestroy           ->  DestroyRef.onDestroy, or effect cleanup
ngDoCheck             ->  nothing, you should not need it
```

A modern component often has no lifecycle hooks at all.

## Quick recap

- The hooks still work but signals made most of them unnecessary.
- `ngOnChanges` is replaced by `computed` and `effect` on signal inputs.
- `ngAfterViewInit` is replaced by `afterNextRender`, which skips the server.
- `ngOnDestroy` is replaced by `DestroyRef.onDestroy`, effect cleanup or `takeUntilDestroyed`.
- Never mix `ngOnChanges` with signal inputs, convert a component's inputs together.
- Avoid `ngDoCheck` and the Checked hooks, they run constantly.
- Implement the interfaces so a misspelt hook is a compile error.

<code id="code-content" class="language-typescript">
import { Component, OnInit, OnDestroy, inject, input, signal, computed,
         effect, viewChild, contentChildren, ElementRef, DestroyRef,
         afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
// A MODERN component often has no lifecycle hooks at all.
@Component({ selector: 'app-chart', template: `&lt;canvas #canvas&gt;&lt;/canvas&gt;` })
export class Chart {
  readonly data = input.required&lt;number[]&gt;();
  private readonly canvas = viewChild.required&lt;ElementRef&lt;HTMLCanvasElement&gt;&gt;('canvas');
  // replaces ngOnChanges: depends only on what it reads, no string keys
  constructor() {
    effect(() =&gt; this.redraw(this.data()));
    // replaces ngAfterViewInit, and does NOT run on the server
    afterNextRender(onCleanup =&gt; {
      const chart = new ThirdPartyChart(this.canvas().nativeElement);
      onCleanup(() =&gt; chart.destroy());        // cleanup beside the setup
    });
    // replaces ngOnDestroy for subscriptions
    this.updates$.pipe(takeUntilDestroyed()).subscribe(u =&gt; this.handle(u));
    // replaces ngOnDestroy for timers
    const id = setInterval(() =&gt; this.poll(), 1000);
    inject(DestroyRef).onDestroy(() =&gt; clearInterval(id));
  }
  private redraw(data: number[]) {}
  private handle(u: unknown) {}
  private poll() {}
  private readonly updates$ = someObservable();
}
// The old way, still valid and still everywhere. Implement the interface
// so a misspelt ngOnint is a COMPILE error rather than a silent no-op.
@Component({ selector: 'app-old', template: `` })
export class Old implements OnInit, OnDestroy {
  private id?: ReturnType&lt;typeof setInterval&gt;;
  ngOnInit(): void { this.id = setInterval(() =&gt; {}, 1000); }
  ngOnDestroy(): void { clearInterval(this.id); }
}
// Modern equivalents:
//   ngOnChanges        -&gt; computed() / effect() on a signal input
//   ngOnInit           -&gt; a field initialiser, or httpResource
//   ngAfterViewInit    -&gt; afterNextRender
//   ngAfterContentInit -&gt; contentChildren (already reactive)
//   ngAfterViewChecked -&gt; afterRenderEffect
//   ngOnDestroy        -&gt; DestroyRef.onDestroy / effect cleanup / takeUntilDestroyed
//   ngDoCheck          -&gt; nothing. It runs on EVERY pass. Avoid it.
// NEVER mix ngOnChanges with signal inputs. It does not fire reliably.
</code></pre>
