---
publishDate: 2026-06-24T12:25
title: Angular Aria Accessibility Patterns
slug: angular-aria
metadescription: Build accessible tabs, menus, comboboxes and trees with Angular Aria, the headless directive package that became stable in Angular 22.
updateDate: 2026-09-07T12:25
author: ['bishal-biswas']
level: 3
tags: ['accessibility', 'aria', 'components']
course: angular
---

## Behaviour without styling

Accessible widgets are hard. A tab list needs arrow key navigation, roving focus, the right ARIA roles and correct relationships between tabs and panels. Getting all of that right is a lot of work, and getting it subtly wrong is very easy.

`@angular/aria` provides **headless** directives implementing the WAI-ARIA patterns. They handle keyboard interaction, focus management and ARIA attributes. They provide no styling at all.

It became stable in Angular 22.

```bash
npm install @angular/aria
```

## Tabs

```typescript
import { Component } from '@angular/core';
import { NgTabs, NgTabList, NgTab, NgTabPanel } from '@angular/aria';

@Component({
  selector: 'app-settings',
  imports: [NgTabs, NgTabList, NgTab, NgTabPanel],
  template: `
    <div ngTabs>
      <div ngTabList>
        <button ngTab value="profile">Profile</button>
        <button ngTab value="security">Security</button>
        <button ngTab value="billing">Billing</button>
      </div>

      <div ngTabPanel value="profile">
        <app-profile-settings />
      </div>

      <div ngTabPanel value="security">
        <app-security-settings />
      </div>

      <div ngTabPanel value="billing">
        <app-billing-settings />
      </div>
    </div>
  `,
})
export class Settings {}
```

You get arrow key navigation between tabs, home and end keys, correct `role="tab"` and `role="tabpanel"`, `aria-selected`, `aria-controls` and `aria-labelledby` wiring, and roving `tabindex` so the tab list is one stop in the tab order.

None of that is in your template, and none of it is styling you have to fight.

## Styling headless directives

Because there is no styling, you write CSS against the ARIA attributes the directives manage.

```css
[ngTab] {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
}

[ngTab][aria-selected="true"] {
  border-bottom: 2px solid var(--brand);
  font-weight: 600;
}

[ngTab][aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
}
```

This is the mental shift. You do not add an `active` class, you style `[aria-selected="true"]`. The state is already in the DOM, correctly, for assistive technology, so styling from it keeps the two in step automatically.

The attributes worth knowing:

```text
aria-selected      tabs, options
aria-expanded      accordions, menus, comboboxes
aria-disabled      anything disabled
aria-checked       checkboxes, radios, switches
aria-current       the current page in navigation
```

## The patterns available

```text
Accordion   ngAccordionGroup, ngAccordionTrigger, ngAccordionPanel, ngAccordionContent
Listbox     ngListbox, ngOption
Combobox    ngCombobox, ngComboboxPopup, ngComboboxWidget
Menu        ngMenuBar, ngMenu, ngMenuItem, ngMenuTrigger, ngMenuContent
Tabs        ngTabs, ngTabList, ngTab, ngTabPanel, ngTabContent
Toolbar     ngToolbar, ngToolbarWidget, ngToolbarWidgetGroup
Tree        ngTree, ngTreeItem, ngTreeItemGroup
Grid        ngGrid, ngGridRow, ngGridCell, ngGridCellWidget
```

Each covers the full keyboard specification for its pattern, which is more than most hand written implementations manage.

## Listbox

```typescript
import { NgListbox, NgOption } from '@angular/aria';

@Component({
  imports: [NgListbox, NgOption],
  template: `
    <ul ngListbox [(value)]="selected">
      @for (country of countries(); track country.code) {
        <li ngOption [value]="country.code">{{ country.name }}</li>
      }
    </ul>
  `,
})
export class CountryPicker {
  protected readonly countries = signal<Country[]>([]);
  protected readonly selected = signal<string | null>(null);
}
```

Arrow keys move, typing jumps to a matching option, and multi select handles shift and control clicking. All of it is standard behaviour users already expect.

## Signal forms integration

The directives expose a `value` model, so `[formField]` binds directly.

```typescript
@Component({
  imports: [NgListbox, NgOption, FormField],
  template: `
    <ul ngListbox [formField]="orderForm.country">
      @for (country of countries(); track country.code) {
        <li ngOption [value]="country.code">{{ country.name }}</li>
      }
    </ul>
  `,
})
export class OrderForm {
  protected readonly model = signal({ country: '' });

  protected readonly orderForm = form(this.model, path => {
    required(path.country, { message: 'Choose a country' });
  });
}
```

An accessible custom select bound into a validated form, with no `ControlValueAccessor` to write.

## Lazy panel content

The structural content directives render their contents only when needed.

```html
<div ngTabs>
  <div ngTabList>
    <button ngTab value="reports">Reports</button>
  </div>

  <div ngTabPanel value="reports">
    <ng-template ngTabContent>
      <app-expensive-report />
    </ng-template>
  </div>
</div>
```

`ngTabContent` inside an `ng-template` means the report is not created until that tab is opened. The same applies to `ngAccordionContent` and `ngMenuContent`.

Combining it with `@defer` delays the download as well as the creation.

## Never replace a native element

The first rule of using this package: do not reimplement something HTML already provides.

```html
<!-- wrong: a native select is better in every way -->
<ul ngListbox>...</ul>

<!-- right -->
<select [formField]="form.country">...</select>
```

A native `<select>` gets platform behaviour for free, including the correct mobile picker. Reach for `ngListbox` only when the design genuinely requires something a `<select>` cannot do, such as rich option content or multi column layout.

The same goes for `<button>`, `<details>`, `<dialog>` and `<input type="checkbox">`. Use the platform first.

## Testing with harnesses

```typescript
import { TabsHarness } from '@angular/aria/testing';

it('switches tabs', async () => {
  const fixture = TestBed.createComponent(Settings);
  const loader = TestbedHarnessEnvironment.loader(fixture);

  const tabs = await loader.getHarness(TabsHarness);
  await tabs.selectTab('Security');

  expect(await tabs.getSelectedTabLabel()).toBe('Security');
});
```

Harnesses test through the same interface a user has, so a test does not break when the internal markup changes.

## Aria or Material?

```text
@angular/aria        behaviour only, you write all the CSS
@angular/material    behaviour plus Material Design styling
```

Use **Aria** when you have your own design system and want the accessibility handled.

Use **Material** when Material Design is acceptable and you want components that look finished.

Material is built on the CDK and provides its own accessibility. You do not need both for the same widget.

## What it does not do

**It does not make your application accessible.** It makes these specific widgets accessible. Colour contrast, heading structure, form labels, focus visibility and meaningful alt text are still your responsibility.

**It does not replace testing.** Use a screen reader, navigate the whole application with only a keyboard, and run an automated checker. Automated tools catch perhaps a third of real problems.

## Quick recap

- `@angular/aria` provides headless directives implementing WAI-ARIA patterns.
- It handles keyboard navigation, focus management and ARIA attributes, and no styling.
- Style from the ARIA attributes, so the visual state and the accessible state stay in step.
- Patterns include tabs, listbox, combobox, menu, accordion, tree, grid and toolbar.
- Directives expose a `value` model, so `[formField]` binds directly.
- Content directives inside `ng-template` render lazily.
- Never replace a native element that already does the job.

<code id="code-content" class="language-typescript">
import { Component, signal } from '@angular/core';
import { NgTabs, NgTabList, NgTab, NgTabPanel, NgTabContent,
         NgListbox, NgOption } from '@angular/aria';
import { form, required, FormField } from '@angular/forms/signals';
// HEADLESS: keyboard navigation, focus management and ARIA attributes.
// No styling at all, which is the point.
@Component({
  selector: 'app-settings',
  imports: [NgTabs, NgTabList, NgTab, NgTabPanel, NgTabContent,
            NgListbox, NgOption, FormField],
  template: `
    &lt;div ngTabs&gt;
      &lt;div ngTabList&gt;
        &lt;!-- arrow keys, home/end, roving tabindex, role="tab",
             aria-selected, aria-controls: all handled --&gt;
        &lt;button ngTab value="profile"&gt;Profile&lt;/button&gt;
        &lt;button ngTab value="reports"&gt;Reports&lt;/button&gt;
      &lt;/div&gt;
      &lt;div ngTabPanel value="profile"&gt;&lt;app-profile /&gt;&lt;/div&gt;
      &lt;div ngTabPanel value="reports"&gt;
        &lt;!-- inside ng-template, so the report is not created
             until this tab is opened --&gt;
        &lt;ng-template ngTabContent&gt;&lt;app-expensive-report /&gt;&lt;/ng-template&gt;
      &lt;/div&gt;
    &lt;/div&gt;
    &lt;!-- The directives expose a value model, so [formField] binds directly.
         An accessible custom select in a validated form, with no
         ControlValueAccessor to write. --&gt;
    &lt;ul ngListbox [formField]="orderForm.country"&gt;
      @for (c of countries(); track c.code) {
        &lt;li ngOption [value]="c.code"&gt;{{ c.name }}&lt;/li&gt;
      }
    &lt;/ul&gt;
  `,
  // THE MENTAL SHIFT: do not add an `active` class. Style from the ARIA
  // attributes the directives already manage, so the visual state and the
  // accessible state cannot drift apart.
  styles: `
    [ngTab] { padding: 0.5rem 1rem; border: none; background: none; }
    [ngTab][aria-selected="true"] { border-bottom: 2px solid var(--brand); }
    [ngTab][aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
    [ngOption][aria-selected="true"] { background: var(--highlight); }
  `,
})
export class Settings {
  protected readonly countries = signal&lt;{ code: string; name: string }[]&gt;([]);
  protected readonly model = signal({ country: '' });
  protected readonly orderForm = form(this.model, path =&gt; {
    required(path.country, { message: 'Choose a country' });
  });
}
// The patterns: Accordion, Listbox, Combobox, Menu, Tabs, Toolbar, Tree, Grid.
// Attributes worth styling from:
//   aria-selected  aria-expanded  aria-disabled  aria-checked  aria-current
// FIRST RULE: never replace a native element that already does the job.
//   &lt;select&gt; gets platform behaviour and the right mobile picker for free.
//   Use ngListbox only when the design needs something &lt;select&gt; cannot do.
// Testing goes through harnesses, so it survives markup changes:
//   const tabs = await loader.getHarness(TabsHarness);
//   await tabs.selectTab('Security');
// This makes THESE WIDGETS accessible. Contrast, heading structure, form
// labels and focus visibility are still yours. Test with a real screen
// reader and with the keyboard only.
</code></pre>
