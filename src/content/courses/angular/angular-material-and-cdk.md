---
publishDate: 2026-06-24T12:30
title: Angular Material and the CDK
slug: angular-material-and-cdk
metadescription: Use Angular Material components and theming, and reach for the CDK when you need behaviour without Material styling.
updateDate: 2026-09-07T12:30
author: ['bishal-biswas']
level: 3
tags: ['material', 'cdk', 'ui']
course: angular
---

## Two packages

**Angular Material** is a component library implementing Material Design: buttons, form fields, dialogs, tables, date pickers.

**The CDK**, or Component Dev Kit, is the behaviour underneath with no styling: overlays, drag and drop, virtual scrolling, focus trapping, accessibility helpers.

Material is built on the CDK. You can use the CDK on its own with your own design system.

```bash
ng add @angular/material
```

That installs both, sets up a theme, adds the typography and configures animations.

## Using components

Each component is imported individually.

```typescript
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field>
      <mat-label>Email</mat-label>
      <input matInput [formField]="userForm.email">
      @if (userForm.email().invalid()) {
        <mat-error>Enter a valid email address</mat-error>
      }
    </mat-form-field>

    <button mat-flat-button color="primary" (click)="save()">Save</button>
  `,
})
export class UserForm {}
```

Material components are still NgModules, which is why you import `MatButtonModule` rather than a component class. That is fine inside a standalone component's `imports`.

Import the specific modules you use. There is no single `MaterialModule` in the library, and creating one yourself pulls in everything.

## Theming

Angular Material 3 themes are built with Sass.

```scss
@use '@angular/material' as mat;

html {
  @include mat.theme((
    color: (
      primary: mat.$violet-palette,
      tertiary: mat.$orange-palette,
    ),
    typography: Roboto,
    density: 0,
  ));
}
```

`density` shrinks component sizes. `0` is the default, and negative values make everything more compact, which suits data heavy applications.

Light and dark:

```scss
html {
  @include mat.theme((
    color: (primary: mat.$violet-palette),
  ));

  color-scheme: light dark;
}
```

`color-scheme: light dark` lets the browser pick based on the user's preference, and Material's system tokens follow.

Overriding one component:

```scss
.compact-toolbar {
  @include mat.toolbar-overrides((
    container-background-color: var(--brand),
    container-text-color: white,
  ));
}
```

Override with the provided mixins rather than `::ng-deep`. They target documented tokens, so they survive upgrades. `::ng-deep` targets internal class names, which do not.

## The CDK

The parts worth knowing.

**Overlay** positions floating content: dropdowns, tooltips, popovers.

```typescript
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

export class Dropdown {
  private readonly overlay = inject(Overlay);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly template = viewChild.required<TemplateRef<unknown>>('menu');
  private readonly trigger = viewChild.required<ElementRef>('trigger');

  private overlayRef?: OverlayRef;

  protected open(): void {
    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay.position()
        .flexibleConnectedTo(this.trigger())
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
        ]),
      hasBackdrop: true,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });

    this.overlayRef.attach(new TemplatePortal(this.template(), this.viewContainer));

    this.overlayRef.backdropClick().subscribe(() => this.close());
  }

  protected close(): void {
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
  }
}
```

The second position in `withPositions` is the fallback when there is no room below. Getting that right by hand is genuinely fiddly.

**Drag and drop:**

```typescript
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  imports: [CdkDropList, CdkDrag],
  template: `
    <div cdkDropList (cdkDropListDropped)="drop($event)">
      @for (task of tasks(); track task.id) {
        <div cdkDrag>{{ task.title }}</div>
      }
    </div>
  `,
})
export class TaskList {
  protected readonly tasks = signal<Task[]>([]);

  protected drop(event: CdkDragDrop<Task[]>): void {
    this.tasks.update(tasks => {
      const copy = [...tasks];
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;
    });
  }
}
```

Copying before `moveItemInArray` matters, because it mutates the array it is given and a signal needs a new reference.

**Virtual scrolling** renders only the visible rows.

```typescript
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  imports: [ScrollingModule],
  template: `
    <cdk-virtual-scroll-viewport itemSize="48" class="viewport">
      <div *cdkVirtualFor="let item of items(); trackBy: trackById" class="row">
        {{ item.name }}
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: `.viewport { height: 400px; } .row { height: 48px; }`,
})
export class BigList {}
```

`itemSize` must match the actual rendered height, and the viewport needs an explicit height. Getting either wrong produces scrolling that jumps.

This is the answer for a list of ten thousand rows. Note it still uses `*cdkVirtualFor` rather than `@for`.

**Accessibility helpers:**

```typescript
import { LiveAnnouncer } from '@angular/cdk/a11y';

export class SaveButton {
  private readonly announcer = inject(LiveAnnouncer);

  protected async save(): Promise<void> {
    await this.api.save();
    this.announcer.announce('Changes saved');
  }
}
```

`LiveAnnouncer` speaks a message to screen readers without any visual change. Screen reader users otherwise get no feedback that a background action succeeded.

`cdkTrapFocus` keeps keyboard focus inside a dialog, which is required for a modal to be usable.

**Clipboard, layout and platform:**

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

export class Toolbar {
  private readonly clipboard = inject(Clipboard);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly isSmall = toSignal(
    this.breakpoints.observe(Breakpoints.Handset).pipe(map(r => r.matches)),
    { initialValue: false },
  );

  protected copy(text: string): void {
    this.clipboard.copy(text);
  }
}
```

## Material or your own components?

**Use Material** when Material Design is acceptable, you want components that work now, and accessibility being handled matters more than visual distinctiveness. It is a large, well tested, actively maintained library.

**Do not use Material** when you have a design system that is not Material. Fighting Material's styling to look like something else is a well known way to lose a lot of time. Use the CDK or `@angular/aria` for behaviour, and write the styling yourself.

The middle path that usually goes badly is adopting Material and then overriding most of its appearance.

## Bundle size

Material components are not tiny. Import only what you use, and check the build output. `MatTable` with sorting, paging and filtering is substantial, and a simple list may not need it.

Defer heavy components:

```html
@defer (on viewport) {
  <mat-table [dataSource]="data()">...</mat-table>
}
```

## Quick recap

- Material provides styled components, the CDK provides behaviour without styling.
- Import specific modules, and do not build a catch all Material module.
- Theme with the Sass mixins, and override with the component mixins rather than `::ng-deep`.
- The overlay handles positioning and fallback positions for floating content.
- Copy an array before `moveItemInArray`, since it mutates in place.
- Virtual scrolling needs a matching `itemSize` and an explicit viewport height.
- `LiveAnnouncer` gives screen reader feedback for actions with no visual change.

<code id="code-content" class="language-typescript">
import { Component, inject, signal, viewChild, ElementRef, TemplateRef, ViewContainerRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Overlay } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Clipboard } from '@angular/cdk/clipboard';
@Component({
  selector: 'app-example',
  // Material components are still NgModules. Import the SPECIFIC ones.
  // There is no MaterialModule, and building one pulls in everything.
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule,
            CdkDropList, CdkDrag, ScrollingModule],
  template: `
    &lt;mat-form-field&gt;
      &lt;mat-label&gt;Email&lt;/mat-label&gt;
      &lt;input matInput&gt;
    &lt;/mat-form-field&gt;
    &lt;button mat-flat-button (click)="copy('hello')"&gt;Copy&lt;/button&gt;
    &lt;!-- drag and drop --&gt;
    &lt;div cdkDropList (cdkDropListDropped)="drop($event)"&gt;
      @for (task of tasks(); track task.id) { &lt;div cdkDrag&gt;{{ task.title }}&lt;/div&gt; }
    &lt;/div&gt;
    &lt;!-- virtual scrolling: itemSize MUST match the real row height,
         and the viewport needs an explicit height, or scrolling jumps --&gt;
    &lt;cdk-virtual-scroll-viewport itemSize="48" style="height: 400px"&gt;
      &lt;div *cdkVirtualFor="let item of tasks()" style="height: 48px"&gt;
        {{ item.title }}
      &lt;/div&gt;
    &lt;/cdk-virtual-scroll-viewport&gt;
  `,
})
export class Example {
  private readonly announcer = inject(LiveAnnouncer);
  private readonly clipboard = inject(Clipboard);
  private readonly overlay = inject(Overlay);
  protected readonly tasks = signal&lt;{ id: number; title: string }[]&gt;([]);
  protected drop(event: CdkDragDrop&lt;unknown[]&gt;): void {
    this.tasks.update(tasks =&gt; {
      const copy = [...tasks];        // moveItemInArray MUTATES, and a
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;                    // signal needs a new reference
    });
  }
  protected copy(text: string): void {
    this.clipboard.copy(text);
    // Screen reader users get no feedback from a background action
    // without this. It speaks without changing anything visually.
    this.announcer.announce('Copied to clipboard');
  }
}
// THEMING with Sass, not CSS overrides:
//   @use '@angular/material' as mat;
//   html {
//     @include mat.theme((
//       color: (primary: mat.$violet-palette),
//       typography: Roboto,
//       density: 0,          // negative values make everything more compact
//     ));
//     color-scheme: light dark;
//   }
// Override with the COMPONENT MIXINS, which target documented tokens and
// survive upgrades. ::ng-deep targets internal class names and does not.
//   .compact { @include mat.toolbar-overrides((container-background-color: red)); }
// Material for Material Design. The CDK or @angular/aria when you have your
// own design system. Adopting Material and then overriding most of its
// appearance is the path that reliably goes badly.
</code></pre>
