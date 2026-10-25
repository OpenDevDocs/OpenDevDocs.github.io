---
publishDate: 2026-06-09T08:15
title: ViewChild and ContentChild Decorators
slug: viewchild-and-contentchild-decorators
metadescription: Understand the query decorators in older Angular code, the static flag, QueryList, and how they map onto signal queries.
updateDate: 2026-09-07T08:15
author: ['bishal-biswas']
level: 2
tags: ['legacy', 'queries', 'viewchild']
course: angular
---

## The decorator queries

Before signal queries, you found elements and children with decorators.

```typescript
import { Component, ViewChild, ViewChildren, ContentChild, ContentChildren,
         ElementRef, QueryList, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-search',
  template: `<input #box>`,
})
export class SearchComponent implements AfterViewInit {
  @ViewChild('box') box!: ElementRef<HTMLInputElement>;

  ngAfterViewInit(): void {
    this.box.nativeElement.focus();
  }
}
```

Note the `!`. The property is undefined until Angular fills it in, so TypeScript needs telling to allow it. That non-null assertion on every query is one of the things signal queries removed.

## The four decorators

```typescript
@ViewChild(UserCard) card!: UserCard;
@ViewChildren(UserCard) cards!: QueryList<UserCard>;
@ContentChild(TabPanel) panel!: TabPanel;
@ContentChildren(TabPanel) panels!: QueryList<TabPanel>;
```

Same view versus content distinction as the signal versions. View is your own template, content is what the caller projected in.

## The static flag

This one caused real confusion.

```typescript
@ViewChild('box', { static: true }) box!: ElementRef;
@ViewChild('box', { static: false }) box!: ElementRef;
```

`static: true` meant the element is always in the DOM, so the result is available in `ngOnInit`. `static: false` meant it might be inside an `*ngIf`, so it is only available in `ngAfterViewInit`.

Get it wrong and you got `undefined` at a time you did not expect.

```typescript
// static: true, available early
@ViewChild('always', { static: true }) always!: ElementRef;

ngOnInit(): void {
  this.always.nativeElement.focus();     // works
}

// static: false, not available yet
@ViewChild('maybe', { static: false }) maybe!: ElementRef;

ngOnInit(): void {
  this.maybe.nativeElement.focus();      // throws, undefined
}

ngAfterViewInit(): void {
  this.maybe?.nativeElement.focus();     // works
}
```

Signal queries removed the flag entirely, because a signal simply has no value until it has one.

## QueryList

The plural decorators return a `QueryList`, which is a custom collection rather than an array.

```typescript
@ViewChildren(Row) rows!: QueryList<Row>;

ngAfterViewInit(): void {
  console.log(this.rows.length);
  console.log(this.rows.first);
  console.log(this.rows.last);

  this.rows.forEach(row => row.reset());

  const array = this.rows.toArray();

  // react to changes
  this.rows.changes.subscribe((list: QueryList<Row>) => {
    console.log('now', list.length);
  });
}
```

`changes` is an observable, so you must subscribe **and** handle the initial value separately, since it does not emit on the first render.

```typescript
ngAfterViewInit(): void {
  this.recount();                                    // initial
  this.rows.changes.subscribe(() => this.recount()); // subsequent
}
```

Forgetting the initial call is a common bug. `viewChildren()` has no such problem, since a signal always has a current value.

## The read option

Same as the signal version. It picks which thing you get from a matched element.

```typescript
@ViewChild(UserCard) instance!: UserCard;
@ViewChild(UserCard, { read: ElementRef }) element!: ElementRef;
@ViewChild('slot', { read: ViewContainerRef }) container!: ViewContainerRef;
@ViewChild('tpl', { read: TemplateRef }) template!: TemplateRef<unknown>;
```

## descendants

```typescript
@ContentChildren(MenuItem) direct!: QueryList<MenuItem>;
@ContentChildren(MenuItem, { descendants: true }) all!: QueryList<MenuItem>;
```

Default is direct children only, same as the signal version.

## A full example

```typescript
@Component({
  selector: 'app-tabs',
  template: `
    <nav>
      <button *ngFor="let tab of tabList" (click)="select(tab)">
        {{ tab.label }}
      </button>
    </nav>
    <ng-content />
  `,
})
export class TabsComponent implements AfterContentInit, OnDestroy {
  @ContentChildren(TabComponent) tabs!: QueryList<TabComponent>;

  tabList: TabComponent[] = [];
  private subscription?: Subscription;

  ngAfterContentInit(): void {
    this.rebuild();
    this.subscription = this.tabs.changes.subscribe(() => this.rebuild());
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private rebuild(): void {
    this.tabList = this.tabs.toArray();
    if (this.tabList.length > 0) this.select(this.tabList[0]);
  }

  select(tab: TabComponent): void { ... }
}
```

The signal version of the same thing:

```typescript
@Component({
  selector: 'app-tabs',
  template: `
    <nav>
      @for (tab of tabs(); track tab.label()) {
        <button (click)="select(tab)">{{ tab.label() }}</button>
      }
    </nav>
    <ng-content />
  `,
})
export class Tabs {
  readonly tabs = contentChildren(Tab);

  protected select(tab: Tab): void { ... }
}
```

Two hooks, a subscription, an unsubscribe and a mirrored array all disappear. The template reads the query directly.

## The mapping

```typescript
// decorators                                     signals
@ViewChild('box') box!: ElementRef;               readonly box = viewChild<ElementRef>('box');
@ViewChild('box', { static: true })               readonly box = viewChild.required<ElementRef>('box');
@ViewChildren(Row) rows!: QueryList<Row>;         readonly rows = viewChildren(Row);
@ContentChild(TemplateRef) tpl!: TemplateRef;     readonly tpl = contentChild(TemplateRef);
@ContentChildren(Tab, { descendants: true })      readonly tabs = contentChildren(Tab, { descendants: true });

this.rows.changes.subscribe(...)                  computed(() => this.rows().length)
ngAfterViewInit() { ... }                         effect(() => { ... })
```

Migrate with:

```bash
ng generate @angular/core:signal-queries-migration
```

## Things to check when migrating

**`QueryList` methods.** `first`, `last`, `toArray`, `forEach` and `changes` have no direct equivalent, since you get a plain array.

```typescript
this.rows.first          ->  this.rows()[0]
this.rows.last           ->  this.rows().at(-1)
this.rows.toArray()      ->  this.rows()
this.rows.forEach(fn)    ->  this.rows().forEach(fn)
this.rows.changes        ->  computed() or effect()
```

**The static flag.** Both cases become the same signal query. Where it was `static: true` and read in `ngOnInit`, move the read into an effect.

**Non-null assertions.** Every `!` on a query property should either disappear with `.required` or become a genuine null check.

## Quick recap

- `@ViewChild` and friends still work and appear throughout existing code.
- They need `!` because Angular fills them in after construction.
- The `static` flag decided whether a result was ready in `ngOnInit`, and was easy to get wrong.
- `QueryList` needed a `changes` subscription plus a separate initial call.
- Signal queries removed the flag, the `QueryList` and the lifecycle hooks.
- Map `first`, `last` and `toArray` onto plain array operations.
- Migrate with `ng generate @angular/core:signal-queries-migration`.

<code id="code-content" class="language-typescript">
import { Component, ViewChild, ViewChildren, ContentChild, ContentChildren,
         ElementRef, QueryList, TemplateRef, ViewContainerRef,
         AfterViewInit, AfterContentInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
@Component({ selector: 'app-legacy-queries', template: `&lt;input #box&gt;&lt;ng-content /&gt;` })
export class LegacyQueries implements AfterViewInit, AfterContentInit, OnDestroy {
  // The ! is needed because Angular fills these in AFTER construction
  @ViewChild('box') box!: ElementRef&lt;HTMLInputElement&gt;;
  // static: true  = always in the DOM, available in ngOnInit
  // static: false = might be inside *ngIf, only in ngAfterViewInit
  @ViewChild('always', { static: true }) always!: ElementRef;
  // read picks WHICH thing you get from the matched element
  @ViewChild('slot', { read: ViewContainerRef }) slot!: ViewContainerRef;
  @ContentChild(TemplateRef) tpl!: TemplateRef&lt;unknown&gt;;
  @ViewChildren(Row) rows!: QueryList&lt;Row&gt;;
  @ContentChildren(Tab, { descendants: true }) tabs!: QueryList&lt;Tab&gt;;
  private subscription?: Subscription;
  ngAfterViewInit(): void {
    this.box.nativeElement.focus();
    console.log(this.rows.length, this.rows.first, this.rows.last);
  }
  ngAfterContentInit(): void {
    this.rebuild();                                    // changes does NOT emit
    this.subscription = this.tabs.changes.subscribe(() =&gt; this.rebuild());
  }                                                    // initially. Forgetting
  ngOnDestroy(): void { this.subscription?.unsubscribe(); }   // the first call is
  private rebuild(): void {}                                  // a classic bug.
}
// The signal versions remove the !, the flag, the QueryList and the hooks:
//   @ViewChild('box') box!: ElementRef        -&gt; viewChild.required&lt;ElementRef&gt;('box')
//   @ViewChildren(Row) rows!: QueryList&lt;Row&gt;  -&gt; viewChildren(Row)
//   @ContentChildren(Tab, {descendants:true}) -&gt; contentChildren(Tab, {descendants:true})
//   this.rows.changes.subscribe(...)          -&gt; computed(() =&gt; this.rows().length)
//   ngAfterViewInit() { ... }                 -&gt; effect(() =&gt; { ... })
// QueryList methods map onto plain arrays:
//   rows.first     -&gt;  rows()[0]
//   rows.last      -&gt;  rows().at(-1)
//   rows.toArray() -&gt;  rows()
// Migrate with:  ng generate @angular/core:signal-queries-migration
class Row {}
class Tab {}
</code></pre>
