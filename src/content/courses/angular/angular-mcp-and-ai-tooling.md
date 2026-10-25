---
publishDate: 2026-06-27T13:10
title: Angular MCP Server and AI-assisted Development
slug: angular-mcp-and-ai-tooling
metadescription: Connect an AI assistant to the Angular CLI with the built in MCP server, so it uses current Angular patterns rather than old ones.
updateDate: 2026-09-07T13:10
author: ['bishal-biswas']
level: 3
tags: ['tooling', 'mcp', 'ai']
course: angular
---

## The problem it solves

AI coding assistants learned Angular from years of public code, and most of that code is old. Ask one for a component and you often get `@Input()` decorators, `*ngIf`, `NgModule` and constructor injection.

That code works, but it is not how Angular is written now, and mixing it into a modern codebase creates inconsistency.

The Angular CLI ships an **MCP server** that gives an assistant access to current documentation, the official best practices guide and your project's actual configuration.

## Running it

```bash
npx @angular/cli mcp
```

That starts the server. It is configured per editor.

```json
// .vscode/mcp.json, or .cursor/mcp.json
{
  "mcpServers": {
    "angular-cli": {
      "command": "npx",
      "args": ["-y", "@angular/cli", "mcp"]
    }
  }
}
```

Other editors use their own paths, such as `.gemini/settings.json` for the Gemini CLI. The configuration block is the same.

Restart the editor afterwards, and the assistant gains the tools below.

## What it provides

```text
get_best_practices        the official modern Angular guidance
search_documentation      queries angular.dev
list_projects             reads angular.json for apps and libraries
run_target                runs a configured build target
devserver.start           starts the dev server without blocking
devserver.stop            stops it
devserver.wait_for_build  returns the latest build logs
onpush_zoneless_migration analyses code and plans an OnPush migration
ai_tutor                  an interactive Angular tutorial
```

The two that change output quality most are `get_best_practices` and `search_documentation`. With them, an assistant writes `input()` rather than `@Input()`, and `@if` rather than `*ngIf`, because it is reading the current guidance rather than recalling old examples.

## Restricting it

```bash
npx @angular/cli mcp --read-only
npx @angular/cli mcp --local-only
```

`--read-only` removes anything that modifies files or runs commands, leaving documentation and inspection. Sensible when you want assistance without letting a tool run builds.

`--local-only` excludes anything needing internet access.

Both are worth considering on a work machine, where an assistant running arbitrary build targets may not be acceptable.

## The dev server tools

```text
devserver.start
devserver.wait_for_build
devserver.stop
```

These let an assistant make a change and then read the actual compiler output rather than guessing whether it compiled.

That closes a real gap. Without it, an assistant writes code, cannot see the result, and confidently reports success while the build fails on a missing import.

## The migration helper

```text
onpush_zoneless_migration
```

It analyses components and produces a plan for moving them to `OnPush` and zoneless, identifying what needs converting to signals first.

Treat it as a survey rather than an automatic fix. The output tells you where the work is, and the CLI schematics do the mechanical parts:

```bash
ng generate @angular/core:signal-input-migration
ng generate @angular/core:control-flow
ng generate @angular/core:inject
```

## Reviewing what it produces

An assistant with better context still produces code you have to read. Things worth checking:

**Version appropriate APIs.** Does it use `input()` or `@Input()`? `@if` or `*ngIf`? `inject()` or a constructor? If old patterns appear, the tooling is not connected properly.

**Invented APIs.** Assistants sometimes produce plausible looking methods that do not exist. `search_documentation` reduces this substantially, but check anything unfamiliar against the real documentation.

**Security.** Anything touching authentication, `bypassSecurityTrustHtml`, or building queries from user input deserves a careful read.

**Tests.** Generated tests often assert that the code does what it does, rather than what it should do. A test asserting the exact markup is worse than no test.

## Where it helps most

**Boilerplate.** A service with CRUD methods, a form with validation, a test file's structure. Repetitive and easy to verify.

**Migration.** Converting a component from decorators to signals is mechanical, and an assistant with current documentation does it accurately.

**Explaining unfamiliar code.** Asking what an inherited component does, with the assistant able to look up any API it does not recognise.

**Getting the shape right.** Writing a custom structural directive or a `ControlValueAccessor` from memory means fetching the documentation. The assistant does that part.

## Where it does not help

**Architecture.** Which state belongs where, how features are bounded, what the domain model is. These need knowledge of your product that no tool has.

**Performance work.** Finding out why an application is slow needs profiling, and the answer is usually specific to your data and usage.

**Anything subtle.** Race conditions, change detection oddities, memory leaks. These need understanding, not pattern matching.

## Related tooling

**`ng update`** performs framework migrations with real code transforms rather than suggestions. It is not AI, and for renamed APIs it is strictly better.

**The `llms.txt` convention.** `angular.dev/llms.txt` provides documentation in a form suited to language models, and some tools read it directly.

**Editor language services.** The Angular Language Service in VS Code gives template type checking, autocomplete and refactoring. Unglamorous, and it catches more real mistakes day to day than an assistant does.

## A reasonable position

The MCP server makes an assistant meaningfully better at Angular by giving it current facts instead of recalled ones. That is a genuine improvement over an assistant working from memory.

It does not remove the need to know Angular. You still have to read the output, judge whether it fits, and understand it well enough to maintain it. Code you did not write and do not understand is a liability whoever produced it.

## Quick recap

- AI assistants often produce old Angular patterns, because that is most of the public code.
- `npx @angular/cli mcp` gives an assistant current documentation and project context.
- Configure it per editor in `.vscode/mcp.json` or the equivalent.
- `get_best_practices` and `search_documentation` improve output quality most.
- The dev server tools let it read real build output instead of guessing.
- Use `--read-only` when you do not want it running commands.
- It helps with boilerplate and migration, not with architecture or performance.

<code id="code-content" class="language-bash">
# The Angular CLI ships an MCP server that gives an AI assistant current
# documentation and your project's real configuration, rather than
# recalled examples from years of older public code.
npx @angular/cli mcp
# Configure it per editor. VS Code: .vscode/mcp.json
#                          Cursor:  .cursor/mcp.json
#                          Gemini:  .gemini/settings.json
# {
#   "mcpServers": {
#     "angular-cli": { "command": "npx", "args": ["-y", "@angular/cli", "mcp"] }
#   }
# }
# Restart the editor afterwards.
# Restrict what it can do. Worth considering on a work machine.
npx @angular/cli mcp --read-only     # documentation and inspection only
npx @angular/cli mcp --local-only    # nothing requiring internet access
# THE TOOLS IT EXPOSES
#   get_best_practices         the official modern Angular guidance
#   search_documentation       queries angular.dev
#   list_projects              reads angular.json
#   run_target                 runs a configured build target
#   devserver.start / stop     starts and stops the dev server
#   devserver.wait_for_build   returns the real build logs
#   onpush_zoneless_migration  analyses code and plans a migration
#   ai_tutor                   an interactive tutorial
# The two that change output quality most are get_best_practices and
# search_documentation: with them an assistant writes input() rather than
# @Input(), and @if rather than *ngIf.
# The devserver tools close a real gap: without them an assistant writes
# code, cannot see the result, and reports success while the build fails.
# For actual migrations, the CLI schematics do real code transforms and
# are strictly better than suggestions:
ng generate @angular/core:signal-input-migration
ng generate @angular/core:control-flow
ng generate @angular/core:inject
ng update @angular/core @angular/cli
# REVIEW WHAT IT PRODUCES:
#   version appropriate APIs?   input() not @Input(), @if not *ngIf
#   invented APIs?              plausible looking methods that do not exist
#   security?                   auth, bypassSecurityTrustHtml, user input
#   tests?                      asserting behaviour, not exact markup
# Helps with: boilerplate, mechanical migration, explaining unfamiliar code.
# Does not help with: architecture, performance work, race conditions.
# The Angular Language Service in your editor is unglamorous and catches
# more real mistakes day to day than any assistant.
</code></pre>
