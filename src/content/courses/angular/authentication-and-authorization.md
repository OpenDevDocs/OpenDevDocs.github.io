---
publishDate: 2026-06-27T13:15
title: Authentication and Authorization
slug: authentication-and-authorization
metadescription: Implement sign in, protect routes, attach tokens to requests, and understand where the real security boundary is.
updateDate: 2026-09-07T13:15
author: ['bishal-biswas']
level: 4
tags: ['security', 'authentication', 'jwt']
course: angular
---

## The one thing to understand first

**Everything in the browser is public.** Your JavaScript, your route guards, your role checks, your hidden buttons. A user can read all of it, change any value in memory, and call your API directly.

Client side authorisation is a **user experience feature**. It stops people seeing screens that will not work for them. It is not a security boundary.

The security boundary is your server. Every endpoint must verify who is calling and whether they are allowed, on every request, regardless of what the client did.

Everything below assumes that is already true.

## Where to keep a token

```text
localStorage      readable by any script, so any XSS steals it
sessionStorage    the same, but cleared when the tab closes
memory only       lost on refresh, but no persistent theft
httpOnly cookie   not readable by JavaScript at all
```

**An httpOnly, Secure, SameSite cookie set by the server is the safest option.** JavaScript cannot read it, so an XSS vulnerability cannot exfiltrate it.

The cost is that you need CSRF protection, because the browser sends the cookie automatically. Angular's XSRF support handles that:

```typescript
provideHttpClient(
  withXsrfConfiguration({
    cookieName: 'XSRF-TOKEN',
    headerName: 'X-XSRF-TOKEN',
  }),
)
```

If you must use a token in JavaScript, keep the access token **in memory** and the refresh token in an httpOnly cookie. A refresh on page load gets a new access token. Nothing valuable persists where a script can read it.

`localStorage` is common and is the weakest of these. Choose it knowingly, not by default.

## An auth service

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly userState = signal<User | null>(null);

  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = computed(() => this.userState() !== null);
  readonly roles = computed(() => this.userState()?.roles ?? []);

  async signIn(credentials: Credentials): Promise<void> {
    const user = await firstValueFrom(
      this.http.post<User>('/api/auth/login', credentials, { withCredentials: true })
    );

    this.userState.set(user);
  }

  async signOut(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}, { withCredentials: true }));

    this.userState.set(null);
    this.router.navigate(['/login']);
  }

  async restore(): Promise<void> {
    try {
      const user = await firstValueFrom(
        this.http.get<User>('/api/auth/me', { withCredentials: true })
      );
      this.userState.set(user);
    } catch {
      this.userState.set(null);
    }
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }
}
```

`restore()` asks the server who the current user is, using the cookie. That is more reliable than decoding a stored token, because the server can reject a revoked session.

## Restoring the session on startup

```typescript
providers: [
  provideAppInitializer(() => inject(AuthService).restore()),
]
```

The application waits for this before rendering, so guards see the correct state on the first navigation. Without it, a refresh on a protected page bounces the user to the login screen and back.

## Guarding routes

```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

export function requireRole(...roles: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);

    return roles.some(role => auth.hasRole(role))
      || inject(Router).createUrlTree(['/forbidden']);
  };
}
```

```typescript
export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  {
    path: 'admin',
    canMatch: [authGuard, requireRole('admin')],
    loadChildren: () => import('./admin/admin.routes').then(m => m.routes),
  },
];
```

`canMatch` on the lazy route means the admin chunk is never downloaded by a non admin. `canActivate` would download it and then block, which leaks the code.

## Returning after login

```typescript
export class Login {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly returnUrl = input('/dashboard');

  protected async submit(credentials: Credentials): Promise<void> {
    await this.auth.signIn(credentials);

    this.router.navigateByUrl(this.returnUrl(), { replaceUrl: true });
  }
}
```

`replaceUrl: true` keeps the back button from returning to the login page.

**Validate the return URL.** An open redirect is a real vulnerability:

```typescript
private safeReturnUrl(): string {
  const url = this.returnUrl();

  return url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard';
}
```

Without that check, `?returnUrl=https://evil.example.com` sends your users somewhere else after they authenticate.

## Attaching the token

With cookies, `withCredentials: true` is all you need. With a bearer token, use an interceptor.

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();

  if (!token || !req.url.startsWith('/api')) return next(req);

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  }));
};
```

The URL check matters. Sending your token to a third party API because someone added an external call is a real way to leak credentials.

## Refreshing

```typescript
let refreshing: Observable<string> | null = null;

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || req.url.includes('/auth/refresh')) {
        return throwError(() => error);
      }

      refreshing ??= auth.refresh().pipe(
        shareReplay(1),
        finalize(() => { refreshing = null; }),
      );

      return refreshing.pipe(
        switchMap(token =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
        catchError(() => {
          auth.signOut();
          return throwError(() => error);
        }),
      );
    }),
  );
};
```

Two details. Concurrent 401s share **one** refresh call rather than each triggering their own. And excluding the refresh endpoint prevents an infinite loop when the refresh itself returns 401.

## Hiding UI

```typescript
@Directive({ selector: '[appHasRole]' })
export class HasRole {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly role = input.required<string>({ alias: 'appHasRole' });

  constructor() {
    effect(() => {
      const allowed = this.auth.hasRole(this.role());

      this.container.clear();

      if (allowed) this.container.createEmbeddedView(this.template);
    });
  }
}
```

```html
<button *appHasRole="'admin'" (click)="deleteEverything()">Delete</button>
```

Again: this hides a button. It does not protect the endpoint.

## Using an identity provider

For anything real, use an established provider rather than building authentication yourself.

```text
Auth0, Okta, Keycloak, Microsoft Entra ID, AWS Cognito, Firebase Auth
```

They handle password hashing, breach detection, multi factor authentication, account recovery and the security review that comes with it. Rolling your own means owning all of that.

For OpenID Connect, `angular-auth-oidc-client` is a well maintained library implementing the flow correctly, including PKCE.

The flow to use in a browser is **authorization code with PKCE**. The implicit flow is deprecated and should not be used in new applications.

## What not to do

**Do not trust anything in a JWT payload without verification.** The payload is base64, not encrypted. Anyone can read it and anyone can write one. Only the server's signature check makes it trustworthy.

**Do not put secrets in the frontend.** Client secrets, API keys, connection strings. Everything shipped to a browser is public.

**Do not rely on hiding a route.** The code is in the bundle unless the route is lazy and guarded with `canMatch`.

**Do not store a token in a plain cookie** without `httpOnly`, `Secure` and `SameSite`. That is the worst of both approaches.

## Quick recap

- Client side authorisation is user experience, not security. The server decides.
- An httpOnly, Secure, SameSite cookie is the safest place for a token.
- Restore the session with an app initialiser so guards see the right state.
- Use `canMatch` on lazy routes so the chunk is never downloaded.
- Validate the return URL after login, or you have an open redirect.
- Share one refresh call between concurrent 401s and exclude the refresh endpoint.
- Use an established identity provider, and the authorization code flow with PKCE.

<code id="code-content" class="language-typescript">
import { Injectable, inject, signal, computed, provideAppInitializer } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn,
         provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { Router, CanActivateFn } from '@angular/router';
import { firstValueFrom, catchError, throwError, switchMap, shareReplay,
         finalize, Observable } from 'rxjs';
// EVERYTHING IN THE BROWSER IS PUBLIC. Guards and role checks stop people
// seeing screens that will not work. They are NOT a security boundary.
// The server must verify every request, whatever the client did.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly userState = signal&lt;User | null&gt;(null);
  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = computed(() =&gt; this.userState() !== null);
  readonly roles = computed(() =&gt; this.userState()?.roles ?? []);
  hasRole(role: string) { return this.roles().includes(role); }
  async signIn(credentials: unknown): Promise&lt;void&gt; {
    // withCredentials sends the httpOnly cookie. Safest token storage:
    // JavaScript cannot read it, so XSS cannot steal it.
    const user = await firstValueFrom(this.http.post&lt;User&gt;(
      '/api/auth/login', credentials, { withCredentials: true }));
    this.userState.set(user);
  }
  // Ask the SERVER who the user is. More reliable than decoding a stored
  // token, because the server can reject a revoked session.
  async restore(): Promise&lt;void&gt; {
    try {
      this.userState.set(await firstValueFrom(
        this.http.get&lt;User&gt;('/api/auth/me', { withCredentials: true })));
    } catch { this.userState.set(null); }
  }
}
export const appConfig = {
  providers: [
    // The app waits for this, so guards see the right state on the FIRST
    // navigation. Without it, refreshing a protected page bounces to login.
    provideAppInitializer(() =&gt; inject(AuthService).restore()),
    // Cookies are sent automatically, so you need CSRF protection
    provideHttpClient(withXsrfConfiguration({
      cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' })),
  ],
};
export const authGuard: CanActivateFn = (route, state) =&gt; {
  const auth = inject(AuthService);
  return auth.isLoggedIn() || inject(Router).createUrlTree(['/login'],
    { queryParams: { returnUrl: state.url } });
};
export function requireRole(...roles: string[]): CanActivateFn {
  return () =&gt; roles.some(r =&gt; inject(AuthService).hasRole(r))
    || inject(Router).createUrlTree(['/forbidden']);
}
// canMatch means the admin chunk is NEVER downloaded by a non admin.
// canActivate would download it and then block, leaking the code.
//   { path: 'admin', canMatch: [authGuard, requireRole('admin')],
//     loadChildren: () =&gt; import('./admin/admin.routes').then(m =&gt; m.routes) }
// VALIDATE THE RETURN URL or you have an open redirect:
//   ?returnUrl=https://evil.example.com sends users away after they sign in
function safeReturnUrl(url: string): string {
  return url.startsWith('/') &amp;&amp; !url.startsWith('//') ? url : '/dashboard';
}
// The token interceptor. The URL check stops your token being sent to a
// third party API when someone adds an external call.
export const authInterceptor: HttpInterceptorFn = (req, next) =&gt; {
  const token = inject(AuthService).accessToken();
  if (!token || !req.url.startsWith('/api')) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
// A JWT payload is base64, NOT encrypted. Anyone can read it and anyone
// can write one. Only the server's signature check makes it trustworthy.
// Use an established provider (Auth0, Keycloak, Entra ID, Cognito) and the
// authorization code flow with PKCE. The implicit flow is deprecated.
interface User { roles: string[]; }
</code></pre>
