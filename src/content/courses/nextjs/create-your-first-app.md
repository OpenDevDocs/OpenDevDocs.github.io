---
publishDate: 2026-10-25T13:02
title: Creating Your First Next.js App
slug: create-your-first-app
metadescription: "Create the Book Nook project with create-next-app, understand every option and prompt, start the dev server and edit your first page in app/page.js."
updateDate: 2026-10-25T13:02
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'create-next-app', 'getting-started']
course: nextjs
---

## What you are about to do

In this lesson you will create **Book Nook**, the online bookshop you will build for the rest of the course. By the end you will have:

- a new Next.js 16 project made with one command
- the dev server running at `http://localhost:3000`
- your own welcome message on the home page, updating live as you save

You need Node.js 20.9 or newer and VS Code. If `node --version` does not print a version yet, go back to [Setting Up Your Computer for Next.js](/courses/nextjs/setting-up-your-computer).

## Step 1: go to your projects folder

Open a terminal and move into the folder where you keep your projects:

```bash
cd ~/projects
```

On Windows, use the folder you made, for example `cd C:\projects`. The new app will be created in a subfolder here.

## Step 2: run create-next-app

**create-next-app** is the official tool that sets up a new Next.js project for you. It creates the folders, writes the starter files and installs the packages. Run this command (it is one long line):

```bash
npx create-next-app@latest book-nook --js --tailwind --eslint --app --cache-components --no-src-dir --import-alias "@/*" --no-react-compiler --no-agents-md
```

That looks like a lot, so here is every part:

| Part | What it means |
| --- | --- |
| `npx create-next-app@latest` | Download the newest create-next-app and run it once. |
| `book-nook` | The project name. It also becomes the folder name. |
| `--js` | Use JavaScript, not TypeScript. TypeScript gets its own lesson later. |
| `--tailwind` | Set up Tailwind CSS for styling. |
| `--eslint` | Set up ESLint, which spots mistakes in your code. |
| `--app` | Use the **App Router** (the `app` folder), the modern way to build Next.js apps. |
| `--cache-components` | Turn on Cache Components, the caching model of Next.js 16. |
| `--no-src-dir` | Put the `app` folder at the top of the project, not inside a `src` folder. |
| `--import-alias "@/*"` | Let you write `@/lib/books` instead of long `../../` paths. |
| `--no-react-compiler` | Skip the React Compiler, an optional optimiser. Keeping things simple. |
| `--no-agents-md` | Do not add an `AGENTS.md` file for AI coding assistants. |

Why so many flags? Without them, create-next-app asks you questions one by one. The flags answer every question in advance, so your project matches the course exactly.

## Or: answer the questions yourself

If you prefer, run the short version and answer the prompts:

```bash
npx create-next-app@latest
```

It asks for a name, then whether to use the recommended defaults:

```text
What is your project named? book-nook
Would you like to use the recommended Next.js defaults?
    Yes, use recommended defaults - TypeScript, ESLint, No React Compiler, Tailwind CSS, No src/ directory, App Router, Cache Components, AGENTS.md
    No, reuse previous settings
    No, customize settings - Choose your own preferences
```

Use the arrow keys to pick **No, customize settings** and press Enter. (The defaults would give you TypeScript, and this course uses JavaScript.) Then answer like this:

```text
Would you like to use TypeScript? No
Which linter would you like to use? ESLint
Would you like to use React Compiler? No
Would you like to use Tailwind CSS? Yes
Would you like your code inside a `src/` directory? No
Would you like to use App Router? (recommended) Yes
Would you like to use Cache Components? Yes
Would you like to customize the import alias (`@/*` by default)? No
Would you like to include AGENTS.md to guide coding agents to write up-to-date Next.js code? No
```

If it also asks whether agents may prepare anonymized feedback, answer **No**. You end up with exactly the same project as the one-line command.

## Step 3: watch it install

create-next-app now downloads Next.js, React and the other packages. This can take a minute or a few, depending on your internet. You will see something like this:

```text
Creating a new Next.js app in C:\projects\book-nook.

Using npm.

Initializing project with template: app-tw


Installing dependencies:
- next
- react
- react-dom

Installing devDependencies:
- @tailwindcss/turbopack
- eslint
- eslint-config-next
- tailwindcss

added 352 packages, and audited 353 packages in 3m

145 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

Generating route types...
✓ Types generated successfully

Initialized a git repository.

Success! Created book-nook at C:\projects\book-nook
```

Your numbers and paths will differ. A few notes:

- **dependencies** are packages your app needs to run. **devDependencies** are packages you only need while building it.
- "packages are looking for funding" is just open-source projects asking for donations. You can ignore it.
- npm may print a few lines starting with `npm warn`. Warnings are not errors. As long as you see **Success!** at the end, everything worked.
- "Initialized a git repository" appears only if Git is installed.

## Step 4: open the project

Move into the new folder and open it in VS Code:

```bash
cd book-nook
code .
```

In the Explorer on the left you will see folders like `app`, `public` and `node_modules`, and files like `package.json` and `next.config.mjs`. You will look at every one of them in [Understanding the Project Files](/courses/nextjs/project-structure). For now, the important one is `app/page.js`.

## Step 5: start the dev server

Open the terminal inside VS Code (**View > Terminal**, or **Ctrl + `**) and run:

```bash
npm run dev
```

This starts the **development server** (or **dev server**): a program on your own computer that builds your pages and shows them in the browser while you work. After a few seconds you see:

```text
▲ Next.js 16.4.3 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://192.168.1.20:3000
✓ Ready in 1.8s
✓ Running next.config.mjs took 466ms
- Cache Components enabled
- Partial Prefetching enabled
```

- **Local** is the address for your own computer. `localhost` means "this computer", and `3000` is the **port**, a numbered door the server listens on.
- **Network** lets other devices on your Wi-Fi (like your phone) open the site. Your address will be different.
- **Turbopack** is the bundler that compiles your code. It is the default in Next.js 16.

Leave this terminal running. The dev server keeps working until you stop it.

## Step 6: open it in the browser

Hold **Ctrl** (or **Cmd** on macOS) and click the `http://localhost:3000` link in the terminal, or type it into your browser.

The first visit takes a moment, because Next.js compiles the page the first time you ask for it. The terminal shows:

```text
○ Compiling / ...
 GET / 200 in 1823ms (next.js: 1655ms, application-code: 168ms)
```

`GET /` means the browser asked for the home page, and `200` means "OK, here it is". The page says **"To get started, edit the page.js file."** with a Next.js logo and two buttons. That is the starter page.

## Step 7: look at app/page.js

Open `app/page.js`. Here is the start of the file create-next-app wrote:

```jsx
// app/page.js (the starter version, shortened)
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert h-5 w-[100px]"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the{" "}
            <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
              page.js
            </code>{" "}
            file.
          </h1>
          {/* ...more text and two buttons... */}
        </div>
      </main>
    </div>
  );
}
```

It is a normal React component:

- `export default function Home()` is the component. A page **must** be the file's default export. That is how Next.js finds it.
- `Image` from `next/image` is Next.js's image component. It works like `<img>` but loads images faster. You will learn it in [Optimizing Images with next/image](/courses/nextjs/optimizing-images).
- The long `className` values are **Tailwind CSS** classes. Each one is a small style: `flex` makes a flexbox, `text-3xl` makes large text, `dark:bg-black` sets a black background in dark mode. See [Styling with Tailwind CSS](/courses/nextjs/tailwind-css).

## Step 8: make it yours

Select everything in `app/page.js` and replace it with this:

```jsx
// app/page.js
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Welcome to Book Nook</h1>
      <p className="mt-2 text-lg text-zinc-600">
        A small shop for big stories.
      </p>
    </main>
  );
}
```

Save the file (**Ctrl + S**, or **Cmd + S** on macOS). Look at the browser: it updates by itself, without you pressing reload. That feature is called **Fast Refresh**, and you will learn how it works in [The Dev Server, Fast Refresh and Error Overlay](/courses/nextjs/dev-server-and-fast-refresh).

Now try changing the text again, for example:

```jsx
// app/page.js
<p className="mt-2 text-lg text-zinc-600">
  A small shop for big stories. Find your next favourite book here.
</p>
```

Save, and watch the browser change again. This loop (edit, save, see) is how you will work through the whole course.

## Step 9: add a little more

Pages are just React, so you can use JavaScript inside them. Let us show a list of featured books from an array:

```jsx
// app/page.js
const featured = ['The Hobbit', 'Dune', 'The Little Prince'];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Welcome to Book Nook</h1>
      <p className="mt-2 text-lg text-zinc-600">
        A small shop for big stories.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Featured this week</h2>
      <ul className="mt-2 list-disc pl-6">
        {featured.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
    </main>
  );
}
```

Save and check the browser. You should see:

```text
Welcome to Book Nook
A small shop for big stories.

Featured this week
• The Hobbit
• Dune
• The Little Prince
```

The browser tab still says **Create Next App**. That title comes from `app/layout.js`, and you will change it in [Pages and Layouts](/courses/nextjs/pages-and-layouts).

## Step 10: stop and restart the server

To stop the dev server, click in the terminal and press **Ctrl + C** (on every system, including macOS). To start it again:

```bash
npm run dev
```

You need to stop and restart only when you change config files like `next.config.mjs`, or install new packages. For normal edits in `app`, just save.

## Common mistakes

### Running npm run dev in the wrong folder

```text
npm error code ENOENT
npm error syscall open
npm error path C:\projects\package.json
npm error errno -4058
npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open 'C:\projects\package.json'
npm error enoent This is related to npm not being able to find a file.
```

npm cannot find `package.json` because you are in the parent folder. Run `cd book-nook` first, then `npm run dev`.

### Port 3000 is already in use

If another app (maybe an older dev server you forgot) is using port 3000, Next.js picks the next free one and tells you:

```text
⚠ Port 3000 is in use by process 12345, using available port 3001 instead.
```

Open the address it prints, like `http://localhost:3001`, or stop the other server first.

### Using capital letters in the project name

npm package names must be lowercase. If you type `Book-Nook`, create-next-app stops right away:

```text
Could not create a project called "Book-Nook" because of npm naming restrictions:
    * name can no longer contain capital letters
```

Use lowercase letters and dashes, like `book-nook`. Spaces are not allowed either.

### Forgetting export default

If you write `function Home()` without `export default`, Next.js cannot find your page and shows an error saying the default export is not a React Component. Every `page.js` needs:

```jsx
// app/page.js
export default function Home() {
  return <h1>Hello</h1>;
}
```

## Quick recap

- `npx create-next-app@latest book-nook --js --tailwind --eslint --app --cache-components --no-src-dir --import-alias "@/*" --no-react-compiler --no-agents-md` creates the course project.
- Or run `npx create-next-app@latest`, choose "No, customize settings", and answer the prompts the same way.
- `cd book-nook`, then `npm run dev` starts the dev server at `http://localhost:3000`, built with Turbopack.
- `app/page.js` is the home page. It must `export default` a React component.
- Save a file and the browser updates by itself (Fast Refresh).
- Stop the server with **Ctrl + C**. Restart it after changing config or installing packages.

<code id="code-content" class="language-jsx">
// app/page.js: the Book Nook home page after this lesson
// Create the project first:
// npx create-next-app@latest book-nook --js --tailwind --eslint --app --cache-components --no-src-dir --import-alias "@/*" --no-react-compiler --no-agents-md
// cd book-nook
// npm run dev   (then open http://localhost:3000)
const featured = ['The Hobbit', 'Dune', 'The Little Prince'];
// A page is a React component, exported as the default export
export default function Home() {
  return (
    &lt;main className="mx-auto max-w-2xl p-8"&gt;
      &lt;h1 className="text-3xl font-bold"&gt;Welcome to Book Nook&lt;/h1&gt;
      &lt;p className="mt-2 text-lg text-zinc-600"&gt;
        A small shop for big stories.
      &lt;/p&gt;
      &lt;h2 className="mt-8 text-xl font-semibold"&gt;Featured this week&lt;/h2&gt;
      {/* Plain JavaScript works inside JSX: turn the array into list items */}
      &lt;ul className="mt-2 list-disc pl-6"&gt;
        {featured.map((title) =&gt; (
          &lt;li key={title}&gt;{title}&lt;/li&gt;
        ))}
      &lt;/ul&gt;
    &lt;/main&gt;
  );
}
</code></pre>
