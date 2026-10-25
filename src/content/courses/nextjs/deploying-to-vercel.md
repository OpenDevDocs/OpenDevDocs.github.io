---
publishDate: 2026-10-25T13:58
title: Deploying to Vercel
slug: deploying-to-vercel
metadescription: Put your Next.js app online with Vercel. Import a GitHub repo, set environment variables, use preview deployments and redeploy safely.
updateDate: 2026-10-25T13:58
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'deployment', 'vercel', 'hosting']
course: nextjs
---

## What you will do

Book Nook works on your computer. Now it is time to put it on the internet, so anyone with the link can visit it.

**Deploying** means copying your app to a computer on the internet (a server) and running it there. You could rent a server and set it all up yourself (you will learn that in [Self-Hosting with Node.js and Docker](/courses/nextjs/self-hosting)), but the easiest way to start is **Vercel**. Vercel is the company that makes Next.js, and its hosting platform understands every Next.js feature out of the box: Server Components, Server Actions, Cache Components, image optimization, all of it.

Vercel has a free **Hobby** plan for personal projects, which is enough for this lesson.

By the end you will have:

1. Your code on GitHub.
2. A live Book Nook at an address like `https://book-nook.vercel.app`.
3. Environment variables set safely on Vercel.
4. A **preview deployment**: a private test copy of the site for every branch you push.

Think of it like a newspaper. You write articles on your laptop (development). GitHub is the editor's desk where finished articles are handed in. Vercel is the printing press: every time something lands on the desk, it prints a fresh edition and puts it on the stands.

## Before you start

Make sure the app builds on your own computer first. If it does not build locally, it will not build on Vercel either:

```bash
npm run lint
npm run build
```

If the build fails, fix it using [Building for Production](/courses/nextjs/building-for-production) before you continue. You also need:

- A free GitHub account.
- Git installed (`git --version` prints a version).

## Step 1: put your code on GitHub

`create-next-app` usually makes a Git repository for you. If `git status` says "not a git repository", run `git init` once in the project folder. You also got a `.gitignore` file, which keeps `node_modules`, `.next` and your `.env*` files out of Git. Check that last one, because it protects your secrets:

```text
# .gitignore (part of it)
# env files (can opt-in for committing if needed)
.env*
```

Save your work in a **commit** (a snapshot of your files):

```bash
git add .
git commit -m "Book Nook ready for its first deploy"
```

Now create an empty repository on GitHub (click **New repository**, name it `book-nook`, and do not add a README, because you already have files). GitHub then shows you the commands to connect your folder. They look like this, with your own username:

```bash
git remote add origin https://github.com/your-username/book-nook.git
git branch -M main
git push -u origin main
```

Refresh the GitHub page and your files are there. Your `.env.local` file is not, which is exactly right.

## Step 2: import the project into Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with **Continue with GitHub**. This links the two accounts.
2. From your Vercel dashboard, choose **Add New**, then **Project**.
3. Under **Import Git Repository**, find `book-nook` and click **Import**. (If you do not see it, use the option to adjust GitHub app permissions and give Vercel access to that repository.)

Vercel now shows a **Configure Project** screen. For a standard Next.js app you change almost nothing:

- **Framework Preset:** Vercel detects **Next.js** by itself.
- **Root Directory:** leave it as `./` (only change it if your app lives in a subfolder).
- **Build and Output Settings:** leave the defaults. Vercel runs `npm install` and then your `build` script, `next build`.

## Step 3: add environment variables

Your `.env.local` file stayed on your computer, so Vercel does not know your secrets. Book Nook needs these (from [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database), [Adding Login with Sessions and Cookies](/courses/nextjs/authentication) and [Sitemaps, robots.txt and App Icons](/courses/nextjs/sitemap-robots-and-icons)):

```text
DATABASE_URL=postgres://bookshop:replace-with-your-password@your-database-host/booknook?sslmode=require
SESSION_SECRET=replace-with-a-long-random-string-at-least-32-characters
SITE_URL=https://book-nook.vercel.app
```

On the Configure Project screen, open **Environment Variables** and add each one: the name in the key box, the value in the value box. Use **new, real values** here, not the ones from your laptop. A quick way to make a long random secret on any system with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`DATABASE_URL` must be the address of a database that Vercel's servers can reach over the internet, such as a hosted Postgres from Neon or Supabase (Vercel's marketplace can create one and fill in the variable for you). A database on `localhost` only exists on your laptop. The build needs it too: `next build` runs your cached `getBooks()` to prerender pages, so the database must be reachable while building.

Two rules to remember:

- Variables **without** `NEXT_PUBLIC_` stay on the server. Use them for secrets.
- Variables **with** `NEXT_PUBLIC_` are copied into the browser JavaScript during the build. Never put a secret in one.

Now click **Deploy**.

## Step 4: watch the build

Vercel shows the build log live. It is the same `next build` you ran at home, so the output looks familiar:

```text
Running "npm run build"

> book-nook@0.1.0 build
> next build

▲ Next.js 16.4.3 (Turbopack)
- Cache Components enabled
- Partial Prefetching enabled

  Creating an optimized production build ...
✓ Compiled successfully
...
Route (app)                       Revalidate  Expire
┌ ○ /                                    15m      1y
...
```

After a minute or two you see a celebration screen with a screenshot of your site. Click it, and Book Nook is live on the internet, at an address ending in `.vercel.app`. Send the link to a friend and try it on your phone.

## Step 5: deploy changes by pushing

Here is the best part. You never click **Deploy** again. Change something small, for example the home page heading:

```jsx
// app/page.js
<h1 className="text-3xl font-bold">Welcome to Book Nook, now online!</h1>
```

Then commit and push:

```bash
git add .
git commit -m "Update home heading"
git push
```

Vercel notices the push to `main`, builds again, and replaces the live site once the new build succeeds. If the build fails, the old version stays online, so a broken commit never takes your site down.

The `main` branch is your **production branch**. Every push to it creates a **production deployment**.

## Step 6: use preview deployments

What if you want to try a bigger change without risking the live site? Use a branch:

```bash
git checkout -b new-about-page
```

Make your changes, then push the branch:

```bash
git add .
git commit -m "Rewrite the about page"
git push -u origin new-about-page
```

Vercel builds this branch too, but as a **preview deployment**: a full copy of the site with its own unique URL. The live site is not touched. If you open a pull request on GitHub, Vercel's bot comments on it with the preview link, so you (or a teammate) can click around before merging.

When you are happy, merge the pull request into `main`. That push to `main` creates a new production deployment.

```text
main branch        ──► Production   https://book-nook.vercel.app
other branches     ──► Preview      https://book-nook-git-new-about-page-yourname.vercel.app
pull requests      ──► Preview      link posted as a comment on the PR
```

Preview URLs look similar to that, but the exact shape depends on your project and account names.

## Step 7: manage environment variables later

To change or add variables after the first deploy, open your project on Vercel, then **Settings**, then **Environment Variables**. Each variable can be turned on for three **environments**:

- **Production:** the live site from `main`.
- **Preview:** all branch and pull request deployments. Handy for a test database, so previews never touch real data.
- **Development:** values you can download to your laptop with the Vercel command line tool.

Important: changing a variable does **not** change deployments that already exist. Go to **Deployments**, open the menu next to the latest production deployment, and choose **Redeploy** so a new build picks up the new value. This matters even more for `NEXT_PUBLIC_` variables, which are baked in at build time.

## Optional: the Vercel CLI

If you prefer the terminal, Vercel has a command line tool:

```bash
npm install -g vercel
vercel login
vercel link          # connect this folder to your Vercel project
vercel env pull .env.local   # download Development variables into .env.local
vercel               # make a preview deployment
vercel --prod        # make a production deployment
```

You do not need it for the Git workflow above, but `vercel env pull` is a nice way to keep your local `.env.local` in sync with the team.

## Where to look when something breaks

- **Build failed:** open the failed deployment and read the build log. Fix the error locally with `npm run build`, push again.
- **Page errors after deploy:** open the deployment and look at its **Logs**. Your server-side `console.log` and `console.error` output shows up there (see [Debugging Next.js Apps](/courses/nextjs/debugging)).
- **Works locally, not on Vercel:** usually a missing environment variable. Check the names carefully; they are case-sensitive.

> **Good to know:** On Vercel your app may run on several servers that start and stop on demand. Anything kept only in a server's memory (like a JavaScript array you push to) can disappear or differ between requests. That is why Book Nook keeps books and reviews in Postgres. Vercel also shares the Next.js cache between those servers for you, so `updateTag` after a new review works everywhere.

To use your own domain name later, open **Settings**, then **Domains**, add the domain, and follow the DNS instructions Vercel shows you. Then update `SITE_URL` and redeploy, so your sitemap and metadata use the new address.

## Common mistakes

### Committing `.env.local`

If you removed `.env*` from `.gitignore`, your secrets are now on GitHub. Put the line back, remove the file from Git with `git rm --cached .env.local`, and **change every secret** in it, because anyone may have seen them.

### Forgetting to redeploy after changing a variable

You changed `SESSION_SECRET` or `DATABASE_URL` on Vercel, but the site still behaves as before. Existing deployments keep the values they were built and started with. Redeploy.

### The build works locally but fails on Vercel

A common cause is a file name with different capital letters. Windows and macOS usually ignore case, but Vercel's Linux build machines do not:

```text
Module not found: Can't resolve '@/components/bookCard'
```

The file is `components/BookCard.js`, so the import must say `BookCard` exactly.

### Putting a secret in `NEXT_PUBLIC_`

`NEXT_PUBLIC_SESSION_SECRET` would be readable by anyone in the browser's JavaScript. Secrets never get that prefix.

## Quick recap

- Vercel is the simplest way to host a Next.js app, and supports every feature.
- Push your code to GitHub, then **Add New**, **Project**, **Import** on Vercel. The Next.js preset needs no changes.
- Add secrets as environment variables in Vercel, never in Git. Redeploy after changing them.
- Every push to `main` makes a production deployment; every other branch or pull request gets its own preview URL.
- Build logs and runtime logs on Vercel are your first stop when something breaks.

<code id="code-content" class="language-bash">
# Deploy Book Nook to Vercel, start to finish
# 1. Make sure it builds locally
npm run lint
npm run build
# 2. Commit and push to GitHub (.env.local stays private thanks to .gitignore)
git add .
git commit -m "Book Nook ready for its first deploy"
git remote add origin https://github.com/your-username/book-nook.git
git branch -M main
git push -u origin main
# 3. On vercel.com: Add New, Project, Import "book-nook"
#    Add DATABASE_URL, SESSION_SECRET and SITE_URL as Environment Variables, then Deploy
# 4. Make a long random secret for SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# 5. Ship an update: every push to main is a production deployment
git add .
git commit -m "Update home heading"
git push
# 6. Try a change safely: a branch gets its own preview URL
git checkout -b new-about-page
git push -u origin new-about-page
</code></pre>
