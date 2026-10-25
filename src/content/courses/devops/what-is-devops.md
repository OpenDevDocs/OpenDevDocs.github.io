---
publishDate: 2026-10-25T10:00
title: What is DevOps? A Culture, Not a Job Title
slug: what-is-devops
metadescription: Learn what DevOps really is, the problem it solves between development and operations teams, where the name came from and what it looks like day to day.
updateDate: 2026-10-25T10:00
author: ['bishal-biswas']
level: 1
tags: ['devops', 'basics', 'culture']
course: devops
---

## What is DevOps?

**DevOps** is a way of building and running software where the people who write the code and the people who keep it running work as one team, share the same goals and automate as much of the journey from code to users as they can.

The name joins two words:

- **Dev** is **development**: the people who write new features and fix bugs.
- **Ops** is **operations**: the people who run the servers, keep the website up and get called at 3 a.m. when it goes down.

DevOps is not a single tool, a product you can buy or one person on a team. It is a set of habits and practices. Tools help, but the heart of it is how people work together.

## The problem DevOps solves

To understand DevOps, picture how many companies worked before it.

The developers spent months building a big batch of features. When they were done, they handed the finished code to the operations team and moved on to the next project. People called this "throwing it over the wall".

The operations team had never seen this code before. They had to install it on the servers, often by hand, following a long checklist. Releases happened rarely, usually late on a Friday night or over a weekend, when fewer customers would notice if something broke.

And things did break. When they did, each side blamed the other:

- **Developers** said: "It worked on my machine. Your servers must be set up wrong."
- **Operations** said: "Your code is broken. We just ran what you gave us."

Notice that the two teams wanted opposite things:

| Team | What they were rewarded for | So they wanted |
|---|---|---|
| Development | Shipping new features | Change, as fast as possible |
| Operations | Keeping the system stable | As little change as possible |

Both goals make sense on their own. Together, they pull the company in two directions. The space between the teams was sometimes called the **wall of confusion**.

Think of a restaurant where the chefs design new dishes but never speak to the waiters, and the waiters serve food but never speak to the chefs. Customers send dishes back, and nobody in the kitchen ever hears why. DevOps puts the chefs and the waiters in the same room.

## Where the name came from

DevOps grew out of frustration with that wall, around 2008 and 2009:

- **2008:** At the Agile conference in Toronto, Andrew Shafer proposed a session on "Agile Infrastructure". Patrick Debois, a Belgian consultant who had felt the dev versus ops pain first-hand, was famously the only person who turned up. The two started talking.
- **2009:** At the Velocity conference, John Allspaw and Paul Hammond from Flickr gave a talk called "10+ Deploys Per Day: Dev and Ops Cooperation at Flickr". At a time when many companies released a few times a year, this sounded almost impossible.
- **2009:** Inspired by that talk, Debois organised the first **DevOpsDays** conference in Ghent, Belgium. The short hashtag **#devops** stuck, and the movement had a name.

Since then, DevOps has spread from web start-ups to banks, governments and almost every kind of company that builds software.

## A culture, not a job title

Today you will see job adverts for a **DevOps Engineer**. That role is real, and this course will teach you the skills it needs. But it is worth being clear about one thing:

> **Note:** DevOps is something a whole team does, not something one person does for the team. A "DevOps engineer" usually builds the tools, pipelines and platforms that let everyone else work the DevOps way.

If a company hires one DevOps engineer, puts them in a new team between development and operations, and changes nothing else, it has built a second wall, not removed the first.

You will also meet two close cousins of DevOps:

- **Site Reliability Engineering (SRE)** started at Google in 2003. It treats running systems as a software problem: engineers write code to automate operations work and set clear, measured targets for how reliable a service must be.
- **Platform engineering** is a newer idea. A platform team builds an internal "paved road" (templates, pipelines, ready-made environments) so other developers can ship safely without becoming experts in every tool.

All three share the same goal: get changes to users quickly **and** safely.

## What DevOps looks like day to day

Here is what a team working the DevOps way usually does:

- **Small, frequent changes.** Instead of one huge release every six months, the team ships small changes every day or even many times a day. Small changes are easier to test, easier to understand and easier to undo.
- **Everything in version control.** Not just the application code, but also the server setup, the build steps and the configuration. You will learn this in [Version Control with Git](/courses/devops/version-control-with-git).
- **Automated build and test.** Every time someone pushes code, a machine builds it and runs the tests. You will meet this as [Continuous Integration](/courses/devops/continuous-integration).
- **Automated, repeatable deployment.** Releasing is a button press or happens on its own, not a 40-step checklist done by hand at midnight.
- **Monitoring and feedback.** The team watches how the software behaves for real users and learns from it quickly.
- **Shared responsibility.** The people who build a service also help run it. If it breaks, developers are part of fixing it.
- **Learning without blame.** When something goes wrong, the team asks "what about our system let this happen?" rather than "whose fault was this?"

Here is the same company before and after:

| | Before DevOps | With DevOps |
|---|---|---|
| How often you release | A few times a year | Daily, or on demand |
| Size of each release | Huge: months of work | Small: hours or days of work |
| How you deploy | By hand, from a checklist | Automated pipeline |
| When problems are found | After release, by customers | Minutes after the code is written, by automated tests |
| When something breaks | Find who to blame | Fix it, then improve the system |

## A first look at automation

You do not need to understand this yet, but here is a taste of what DevOps automation looks like. This short file tells **GitHub Actions**, a popular automation service, to test the code every time someone pushes a change:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: npm ci
      - run: npm test
```

In plain words: "Whenever code is pushed, borrow a fresh Ubuntu Linux machine, download the code, install its dependencies and run the tests." If the tests fail, the whole team finds out within minutes.

The full version of this file, with a deploy step, is in the code panel for this lesson. You will build one yourself in [Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline).

## Common misunderstandings

### "DevOps is a tool"

You will hear people say "we use DevOps" when they mean "we use Jenkins" or "we use Kubernetes". Tools support DevOps, but a team can own every tool on the market and still throw code over the wall. The practices come first.

### "DevOps means developers do all the operations work"

Not quite. It means developers and operations people **share** the work and the responsibility. Operations skills (networking, security, reliability) are still needed. They are just no longer locked away in a separate team that only hears about changes at the last minute.

### "Going faster means breaking more things"

This feels true, but research says the opposite. Years of surveys by the DORA research group show that the best teams deploy **more** often **and** have **fewer** failures, because each change is small and well tested. You will see the numbers in [Measuring DevOps: The Four DORA Metrics](/courses/devops/dora-metrics).

### "DevOps is only for big tech companies"

A solo developer with one website benefits from automated tests and one-click deploys just as much as Netflix does. The scale is different, but the ideas are the same.

## Quick recap

- **DevOps** brings development and operations together as one team with shared goals.
- It solves the old "throw it over the wall" problem, where one team wanted change and the other wanted stability.
- The name came from the DevOpsDays conference in 2009, inspired by Flickr's "10+ deploys per day" talk.
- DevOps is a **culture and set of practices**, not a tool or a single job title.
- In practice it means small changes, automation, monitoring, shared responsibility and learning without blame.
- Done well, it makes teams both **faster** and **more stable**.

Next, you will follow a single change on its whole journey from idea to users in [The Software Delivery Lifecycle](/courses/devops/software-delivery-lifecycle).

<code id="code-content" class="language-yaml">
# .github/workflows/ci.yml: a small DevOps pipeline in one file.
# Every push is built and tested. Pushes to main are also deployed,
# but only if every test passed first.
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest          # a fresh Linux machine every run
    steps:
      # 1. Get the code
      - uses: actions/checkout@v5
      # 2. Install the language runtime
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      # 3. Install the exact dependency versions from package-lock.json
      - run: npm ci
      # 4. Let the machine catch mistakes, not the customers
      - run: npm run lint
      - run: npm test
  deploy:
    needs: test                     # waits for the test job, and stops if it failed
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      # 5. Ship it. The secret lives in GitHub, never in the code
      - run: ./scripts/deploy.sh
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
</code></pre>
