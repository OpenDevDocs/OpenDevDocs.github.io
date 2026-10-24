---
publishDate: 2026-06-13T09:25
title: RouterLink, RouterLinkActive and Navigation
slug: routerlink-and-navigation
metadescription: Link between routes in templates and navigate from code, with active link styling and the navigation options that matter.
updateDate: 2026-09-07T09:25
author: ['bishal-biswas']
level: 2
tags: ['routing', 'navigation', 'routerlink']
course: angular
---

## Linking in templates

```typescript
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive],
  template: `
    <a routerLink="/home">Home</a>
    <a routerLink="/users">Users</a>
    <a [routerLink]="['/users', user.id]">{{ user.name }}</a>
  `,
})
```

Use `routerLink`, not `href`. A plain `href` reloads the whole application, throwing away all state and re-downloading everything.

```html
<a href="/users">Full page reload, slow</a>
<a routerLink="/users">Client side navigation, instant</a>
```

## Static and dynamic

```html
<!-- static string -->
<a routerLink="/users/42">User 42</a>

<!-- an array, which is the flexible form -->
<a [routerLink]="['/users', user.id]">Profile</a>
<a [routerLink]="['/users', user.id, 'orders', order.id]">Order</a>
```

The array form joins segments with slashes and encodes each one, which is what you want for values containing spaces or special characters.

```html
<a [routerLink]="['/search', 'red shoes']">   <!-- /search/red%20shoes -->
```

## Relative links

Without a leading slash, the link is relative to the current route.

```html
<a routerLink="/users/42">absolute</a>
<a routerLink="edit">relative to the current route</a>
<a routerLink="../">up one level</a>
<a [routerLink]="['../', siblingId]">a sibling</a>
```

Relative links make a feature portable, since moving it under a different parent path does not break its internal links.

## Query parameters and fragments

```html
<a [routerLink]="['/search']" [queryParams]="{ q: 'shoes', page: 2 }">Search</a>
<!-- /search?q=shoes&page=2 -->

<a routerLink="/docs" fragment="installation">Installation</a>
<!-- /docs#installation -->

<a
  [routerLink]="['/search']"
  [queryParams]="{ page: 3 }"
  queryParamsHandling="merge">Next page</a>
```

`queryParamsHandling` decides what happens to existing parameters:

```text
''          replace them all, the default
'merge'     keep existing ones and add or overwrite these
'preserve'  keep existing ones and ignore the new ones
```

`merge` is what you want for pagination and filters, so changing the page does not lose the search term.

## Active links

```html
<a
  routerLink="/users"
  routerLinkActive="active"
  [routerLinkActiveOptions]="{ exact: true }">Users</a>
```

`routerLinkActive` adds a class when the link matches the current URL.

The `exact` option matters. Without it, a link to `/` is active on every page, since prefix matching says every URL starts with `/`.

```html
<!-- always active without exact -->
<a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>

<!-- correct: /users should stay active on /users/42 -->
<a routerLink="/users" routerLinkActive="active">Users</a>
```

For a nav bar, use `exact: true` on the home link and leave it off for section links.

You can also read the state:

```html
<a routerLink="/users" routerLinkActive #link="routerLinkActive">
  Users {{ link.isActive ? '(here)' : '' }}
</a>
```

## Navigating from code

```typescript
export class LoginForm {
  private readonly router = inject(Router);

  async submit(): Promise<void> {
    await this.auth.login(this.credentials());

    this.router.navigate(['/dashboard']);
  }
}
```

`navigate` takes the same array form as `routerLink`:

```typescript
this.router.navigate(['/users', id]);
this.router.navigate(['/search'], { queryParams: { q: term } });
this.router.navigate(['/docs'], { fragment: 'setup' });
this.router.navigateByUrl('/users/42?tab=orders');
```

`navigateByUrl` takes a complete URL string. `navigate` takes segments and is safer, because it encodes them.

## Navigation options

```typescript
this.router.navigate(['/users'], {
  queryParams: { page: 2 },
  queryParamsHandling: 'merge',
  fragment: 'top',
  replaceUrl: true,          // replace the history entry instead of pushing
  skipLocationChange: true,  // navigate without changing the URL
  state: { from: 'search' }, // data not visible in the URL
  relativeTo: this.route,    // resolve relative to a route
});
```

**`replaceUrl: true`** is the one to remember. After a successful login, replacing the history entry means the back button does not return to the login page.

**`state`** carries data that should not appear in the URL:

```typescript
this.router.navigate(['/confirmation'], { state: { orderId: 123 } });
```

```typescript
const state = this.router.getCurrentNavigation()?.extras.state;
```

It is lost on refresh, so treat it as a convenience rather than a source of truth.

## Relative navigation from code

```typescript
export class UserDetail {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  edit(): void {
    this.router.navigate(['edit'], { relativeTo: this.route });
  }

  back(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
```

Without `relativeTo`, a path with no leading slash is resolved from the root, which is rarely what you meant.

## The return value

`navigate` returns a promise resolving to `true` if the navigation happened, `false` if a guard blocked it, and rejecting on error.

```typescript
const succeeded = await this.router.navigate(['/admin']);

if (!succeeded) {
  this.notifications.show('You do not have access');
}
```

Worth checking when a guard might redirect.

## Building a URL without navigating

```typescript
const tree = this.router.createUrlTree(['/users', 42], {
  queryParams: { tab: 'orders' },
});

const url = this.router.serializeUrl(tree);   // '/users/42?tab=orders'
```

`createUrlTree` is also what a guard returns to redirect:

```typescript
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).isLoggedIn() || router.createUrlTree(['/login']);
};
```

## External links

`routerLink` is for internal routes only. Use `href` for anything else.

```html
<a href="https://angular.dev" target="_blank" rel="noopener noreferrer">Docs</a>
<a href="mailto:hello@example.com">Email</a>
<a href="/files/report.pdf" download>Download</a>
```

`rel="noopener noreferrer"` on `target="_blank"` links is a security habit worth keeping.

## Quick recap

- Use `routerLink`, never `href`, for internal navigation.
- The array form encodes each segment, which matters for user supplied values.
- Links without a leading slash are relative to the current route.
- `queryParamsHandling: 'merge'` preserves existing parameters.
- `routerLinkActive` needs `{ exact: true }` on a link to `/`.
- `router.navigate` takes the same array form, plus options like `replaceUrl`.
- `replaceUrl: true` after login keeps the back button sensible.

<code id="code-content" class="language-typescript">
import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    &lt;!-- routerLink, NOT href. href reloads the whole application. --&gt;
    &lt;a routerLink="/users"&gt;Users&lt;/a&gt;
    &lt;!-- the array form encodes each segment: /search/red%20shoes --&gt;
    &lt;a [routerLink]="['/search', 'red shoes']"&gt;Search&lt;/a&gt;
    &lt;a [routerLink]="['/users', userId, 'orders', orderId]"&gt;Order&lt;/a&gt;
    &lt;!-- no leading slash means RELATIVE to the current route --&gt;
    &lt;a routerLink="edit"&gt;Edit&lt;/a&gt;
    &lt;a routerLink="../"&gt;Up one level&lt;/a&gt;
    &lt;!-- merge keeps the existing query params, so paging keeps the search term --&gt;
    &lt;a [routerLink]="['/search']" [queryParams]="{ page: 2 }"
       queryParamsHandling="merge"&gt;Next page&lt;/a&gt;
    &lt;a routerLink="/docs" fragment="installation"&gt;Installation&lt;/a&gt;
    &lt;!-- exact: true or a link to / is active on EVERY page --&gt;
    &lt;a routerLink="/" routerLinkActive="active"
       [routerLinkActiveOptions]="{ exact: true }"&gt;Home&lt;/a&gt;
    &lt;!-- leave exact off here, so /users stays active on /users/42 --&gt;
    &lt;a routerLink="/users" routerLinkActive="active"&gt;Users&lt;/a&gt;
    &lt;!-- external links use href, with rel for security --&gt;
    &lt;a href="https://angular.dev" target="_blank" rel="noopener noreferrer"&gt;Docs&lt;/a&gt;
  `,
})
export class Nav {
  protected readonly userId = 42;
  protected readonly orderId = 7;
}
@Component({ selector: 'app-login', template: `` })
export class Login {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  async submit(): Promise&lt;void&gt; {
    // replaceUrl so the back button does not return to the login page
    const ok = await this.router.navigate(['/dashboard'], { replaceUrl: true });
    if (!ok) console.log('a guard blocked it');
  }
  edit(): void {
    // relativeTo, or a path with no leading slash resolves from the ROOT
    this.router.navigate(['edit'], { relativeTo: this.route });
  }
  search(term: string): void {
    this.router.navigate(['/search'], {
      queryParams: { q: term },
      queryParamsHandling: 'merge',
      state: { from: 'header' },      // not in the URL, and lost on refresh
    });
  }
  // Build a URL without navigating. Guards return this to redirect.
  linkFor(id: number) {
    return this.router.serializeUrl(
      this.router.createUrlTree(['/users', id], { queryParams: { tab: 'orders' } }));
  }
}
</code></pre>
