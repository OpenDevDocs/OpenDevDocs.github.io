# Decap CMS

The site is edited through [Decap CMS](https://decapcms.org) at **`/admin`**
(<https://opendevdocs.github.io/admin>).

Decap is a browser app that talks straight to GitHub. Every save is a commit to
`opendevdocs/opendevdocs.github.io@main`, which triggers
[`deploy.yml`](../.github/workflows/deploy.yml) and republishes the site. There is no
database and no server holding content.

- Admin app: [`src/pages/admin/index.astro`](../src/pages/admin/index.astro)
- Collection config: [`public/admin/config.yml`](../public/admin/config.yml)

---

## What you can edit

| Collection          | Edits                        | Files                                       | URL                          |
| ------------------- | ---------------------------- | ------------------------------------------- | ---------------------------- |
| **Blog**            | Standalone posts             | `src/content/blog/<slug>.md`                | `/blog/<slug>`               |
| **Course Articles** | Topic pages inside a course  | `src/content/courses/<language>/<slug>.md`  | `/courses/<language>/<slug>` |
| **Course Syllabus** | Topic list/order per course  | `src/data/syllabus/<language>.json`         | `/courses/<language>`        |
| **Legal Pages**     | Privacy, terms, disclaimer   | `src/content/legal/<slug>.md`               | `/<slug>`                    |
| **Site Data**       | Languages and authors        | `src/data/courses.json`, `src/data/authors.json` | site-wide               |

Blog, Course Articles, and Legal Pages are Astro content collections defined in
[`src/content.config.ts`](../src/content.config.ts). Site Data and Course Syllabus are
plain JSON re-exported by thin modules (`src/data/courses.js`, `src/data/authors.js`,
`src/content/syllabus.js`) so every existing page import keeps working untouched.

---

## Logging in

GitHub Pages serves static files only, so it cannot run the GitHub OAuth handshake.
That is delegated to an OAuth proxy, configured in `config.yml`:

```yaml
backend:
    name: github
    repo: opendevdocs/opendevdocs.github.io
    branch: main
    base_url: https://decap-oauth-bishal.vercel.app
```

Requirements for login to work:

1. The GitHub OAuth App's **Authorization callback URL** must point at the proxy's
   callback route (e.g. `https://decap-oauth-bishal.vercel.app/callback`), and the
   proxy needs that app's client ID and secret in its environment.
2. Decap requests `<base_url>/auth`. If your proxy exposes Vercel-style routes
   (`/api/auth`, `/api/callback`) instead, uncomment this line in `config.yml`:
   ```yaml
   # auth_endpoint: api/auth
   ```
   A 404 on the popup right after clicking *Login with GitHub* is the symptom.
3. The GitHub account you log in with needs write access to the repo. A collaborator
   account works. If the **OpenDevDocs** org restricts third-party OAuth apps, an org
   owner has to approve the OAuth App once — otherwise login succeeds but the repo is
   invisible to the CMS.

---

## Editing locally

Decap can write to the working tree instead of GitHub, which is the fastest way to try
changes before they go live. Two terminals:

```bash
npm run cms
```

```bash
npm run dev
```

Then open <http://localhost:4321/admin>. Login needs no credentials — saves land
directly in your working tree as ordinary file changes, so review them with
`git diff` and commit as usual.

`local_backend: true` is only honoured when the site is served from localhost, so it
has no effect on the deployed site.

> **Port note:** `npm run cms` listens on port 8081. If another project's
> `decap-server` is already running, it exits with `EADDRINUSE` — stop the other one
> first. Do not just ignore the error: a proxy running from a different folder will
> happily serve that other repo's files into this CMS.

---

## Rules worth knowing

**Slugs are the wiring.** Nothing is joined by database IDs, so a few fields have to
agree with each other:

- A course article's **URL slug** must equal the **topic slug** in that course's
  syllabus. If they differ, the topic card on the course page links to a 404.
- A language's **slug** in Site Data is both its URL (`/courses/<slug>`) and the folder
  name articles are stored in (`src/content/courses/<slug>/`).
- The syllabus **Course name** must match the language **Title** exactly (`C Sharp`,
  not `C#`), because the course page pairs them by name.
- An author's **Author ID** is referenced by every article, post, and language that
  credits them. Renaming an ID silently drops those credits — add a new author instead.

**A language only appears on the site when *Available* is on.** Unavailable languages
are filtered out of `/courses` and get no course page, so you can add one and fill in
its syllabus before it is visible.

**Images.** Uploads through the CMS go to `public/assets/uploads/` and are referenced
as `/assets/uploads/<file>`. Two fields are deliberately plain text instead, because
the site builds their URLs from a CDN convention rather than a path:

- Language *logo file name* — a bare name, no extension (`c-sharp`), resolved against
  the `course-logo` CDN folder.
- Author *image* — a file name (`bishal-biswas.png`) in the `author-imgs` CDN folder,
  or a full `https://` URL.

**Blog drafts.** Switching *Draft* on keeps the post in the repo but excludes it from
the build, so nothing half-written ships.

**Legal pages are served at the site root.** A legal page with slug `refund-policy`
publishes to `/refund-policy` — no prefix. They render through
[`src/pages/[legal].astro`](<../src/pages/[legal].astro>), which builds the sidebar
table of contents automatically from the `##` headings in the body.

---

## Changing the form fields

Widgets, hints, and validation all live in `public/admin/config.yml`. When you add a
field there, add it to the matching Zod schema in `src/content.config.ts` too (or the
build will reject the new frontmatter). Field reference:
<https://decapcms.org/docs/widgets/>.

To review posts before they go live, add `publish_mode: editorial_workflow` at the top
of `config.yml`; Decap then opens a pull request per entry instead of committing to
`main` directly.
