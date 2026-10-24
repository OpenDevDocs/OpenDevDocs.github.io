---
publishDate: 2026-06-27T13:20
title: 'Security: XSS, Sanitisation and CSP'
slug: security-xss-and-csp
metadescription: Understand how Angular prevents cross site scripting, when you bypass that protection, and how to add a content security policy.
updateDate: 2026-09-07T13:20
author: ['bishal-biswas']
level: 4
tags: ['security', 'xss', 'csp']
course: angular
---

## Angular escapes by default

```typescript
protected readonly comment = '<script>alert("stolen")</script>';
```

```html
<p>{{ comment }}</p>
```

That renders the tags as visible text. Nothing executes.

Interpolation escapes everything, which is why cross site scripting is genuinely hard to introduce by accident in Angular. It is the framework's strongest security property.

## Sanitisation

Binding to `innerHTML` is different. Angular **sanitises** rather than escapes, removing dangerous parts and keeping safe markup.

```typescript
protected readonly html = '<p>Hello <b>world</b></p><script>alert(1)</script>';
```

```html
<div [innerHTML]="html"></div>
```

The paragraph and bold tag render. The script is removed, and Angular logs a warning saying it sanitised the value.

Sanitisation applies to several contexts:

```text
HTML          innerHTML
Style         style bindings
URL           href, src
Resource URL  iframe src, script src, object data
```

Resource URLs are the strictest, because loading a script from an attacker's domain is complete compromise. Angular will not sanitise a resource URL at all, so it must be marked trusted explicitly.

## Bypassing, carefully

```typescript
import { DomSanitizer } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class VideoService {
  private readonly sanitizer = inject(DomSanitizer);

  embedUrl(videoId: string): SafeResourceUrl {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      throw new Error('Invalid video id');
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${videoId}`
    );
  }
}
```

```html
<iframe [src]="embedUrl" allowfullscreen></iframe>
```

The methods are:

```typescript
bypassSecurityTrustHtml(value)
bypassSecurityTrustStyle(value)
bypassSecurityTrustScript(value)
bypassSecurityTrustUrl(value)
bypassSecurityTrustResourceUrl(value)
```

They are deliberately verbose. You are turning off a protection, and the name says so.

**The rule: never pass user input to one of these.** The example above validates the id against a strict pattern first and builds the URL itself. That is the only safe shape.

```typescript
// a vulnerability
this.sanitizer.bypassSecurityTrustHtml(userSuppliedContent);

// safe: validate, then construct
const id = validateVideoId(input);
this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${id}`);
```

If you need to render user supplied HTML, sanitise it with a dedicated library such as DOMPurify with a strict allow list, then bind normally so Angular sanitises again.

## Where Angular cannot help

**Direct DOM manipulation:**

```typescript
// bypasses every Angular protection
this.element.nativeElement.innerHTML = userContent;
document.write(userContent);
```

**Dynamically built URLs:**

```html
<a [href]="userSuppliedUrl">Click</a>
```

Angular sanitises `href`, blocking `javascript:` URLs. It does not stop an open redirect to an attacker's site. Validate the destination yourself.

**Server rendered content.** If your server injects unescaped user content into `index.html`, Angular never sees it.

**`eval` and `new Function`.** Anything evaluating strings as code.

## Content Security Policy

Sanitisation is one layer. A content security policy is the second: even if something injects a script, the browser refuses to run it.

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'nonce-{RANDOM}';
  img-src 'self' data: https://cdn.example.com;
  font-src 'self';
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

The important directives:

**`script-src 'self'`** allows scripts only from your own origin. This is what stops an injected inline script.

**`frame-ancestors 'none'`** prevents your site being framed, which blocks clickjacking. It replaces the older `X-Frame-Options` header.

**`base-uri 'self'`** stops an injected `<base>` tag redirecting every relative URL.

**`connect-src`** limits where the application can send data, which contains the damage if something is injected.

## Angular and inline styles

Angular's emulated view encapsulation adds inline styles, so a strict `style-src 'self'` blocks them. The correct fix is a nonce.

```typescript
bootstrapApplication(App, {
  providers: [
    { provide: CSP_NONCE, useValue: (window as any).cspNonce },
  ],
});
```

```html
<!-- the server injects the same nonce it sent in the header -->
<script nonce="{{ nonce }}">window.cspNonce = '{{ nonce }}';</script>
```

The nonce must be **random per response** and match the header. A fixed nonce provides no protection at all, since an attacker can simply include it.

Avoid `'unsafe-inline'`. It disables most of the benefit of a policy.

## Rolling out a policy

```text
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

Report only mode logs violations without blocking anything. Run it for a week, read the reports, fix what breaks, then switch to enforcing.

Deploying a strict policy directly usually breaks analytics, fonts or an embedded widget, and the failure is a blank area with a console error.

## Other headers

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

These are server configuration, not Angular, and they are cheap to add.

## Dependencies

```bash
npm audit
npm audit fix
```

Most real vulnerabilities in a frontend application come from dependencies rather than from your own code. A tool like Dependabot or Renovate keeping them current is worth more than most hand written security code.

## A checklist

```text
never pass user input to bypassSecurityTrust*
never set innerHTML directly on a native element
validate any URL before binding it to href or src
never put secrets in frontend code
add a content security policy, starting in report only mode
use a nonce rather than 'unsafe-inline'
set the security headers on the server
keep dependencies current
authorise on the server, always
```

## Quick recap

- Interpolation escapes, and `innerHTML` sanitises, which prevents most XSS.
- `bypassSecurityTrust*` turns that off, so never give it user input.
- Validate and construct URLs yourself rather than trusting one.
- Setting `nativeElement.innerHTML` bypasses every Angular protection.
- A content security policy is the second layer, and stops injected scripts running.
- Use a per response nonce for Angular's inline styles, not `'unsafe-inline'`.
- Roll out a policy in report only mode first.

<code id="code-content" class="language-typescript">
import { Injectable, inject, CSP_NONCE } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
// Interpolation ESCAPES. This renders the tags as visible text.
//   protected readonly comment = '&lt;script&gt;alert(1)&lt;/script&gt;';
//   &lt;p&gt;{{ comment }}&lt;/p&gt;
// [innerHTML] SANITISES: safe markup survives, scripts are stripped.
//   &lt;div [innerHTML]="html"&gt;&lt;/div&gt;
@Injectable({ providedIn: 'root' })
export class VideoService {
  private readonly sanitizer = inject(DomSanitizer);
  embedUrl(videoId: string): SafeResourceUrl {
    // THE ONLY SAFE SHAPE: validate strictly, then CONSTRUCT the URL.
    // Never pass user input straight to a bypass method.
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) throw new Error('Invalid video id');
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${videoId}`);
  }
}
// The bypass methods are deliberately verbose. You are turning off a
// protection, and the name says so:
//   bypassSecurityTrustHtml / Style / Script / Url / ResourceUrl
// A VULNERABILITY:
//   this.sanitizer.bypassSecurityTrustHtml(userSuppliedContent);
// To render user HTML, sanitise with DOMPurify and a strict allow list
// first, then bind normally so Angular sanitises again.
// WHERE ANGULAR CANNOT HELP:
//   this.element.nativeElement.innerHTML = userContent;   bypasses everything
//   document.write(userContent);
//   [href]="userSuppliedUrl"    javascript: is blocked, an open redirect is not
//   server injecting unescaped content into index.html
// CONTENT SECURITY POLICY: the second layer. Even if something is
// injected, the browser refuses to run it.
//   Content-Security-Policy:
//     default-src 'self';
//     script-src 'self';                    stops injected inline scripts
//     style-src 'self' 'nonce-{RANDOM}';
//     connect-src 'self' https://api.example.com;   limits exfiltration
//     frame-ancestors 'none';               blocks clickjacking
//     base-uri 'self';                      stops an injected &lt;base&gt; tag
// Angular's view encapsulation adds inline styles, so give it a nonce
// rather than resorting to 'unsafe-inline':
export const appConfig = {
  providers: [{ provide: CSP_NONCE, useValue: (window as any).cspNonce }],
};
// The nonce must be RANDOM PER RESPONSE and match the header. A fixed
// nonce protects nothing, because an attacker can just include it.
// ROLL IT OUT in report only mode first, or you will ship a blank area:
//   Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
// Also worth setting on the server:
//   Strict-Transport-Security  X-Content-Type-Options: nosniff
//   Referrer-Policy            Permissions-Policy
// And most real frontend vulnerabilities come from dependencies:
//   npm audit    plus Dependabot or Renovate keeping them current
</code></pre>
