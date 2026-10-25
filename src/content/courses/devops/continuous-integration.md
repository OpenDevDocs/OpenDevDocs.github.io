---
publishDate: 2026-10-25T11:10
title: Continuous Integration Explained
slug: continuous-integration
metadescription: Learn what continuous integration is, the problem of integration hell it solves, the core CI practices, what a CI pipeline does on every push, and the habits that keep the main branch green.
updateDate: 2026-10-25T11:10
author: ['bishal-biswas']
level: 1
tags: ['devops', 'ci-cd', 'continuous-integration', 'automation']
course: devops
---

## What is continuous integration?

**Continuous integration** (**CI**) is the habit of merging everyone's work into the main branch **often**, at least once a day, and having a machine **automatically build and test** the result every time.

The name says it all:

- **Integration** means combining one developer's changes with everyone else's.
- **Continuous** means doing it all the time, in small pieces, instead of once in a while in one big lump.

CI is the first and most important step of the automated pipeline that runs through the rest of this section. Without it, nothing downstream can be trusted.

## The problem: integration hell

Before CI, teams often worked like this. Each developer took a copy of the code and worked alone for weeks. Near the release date, everyone merged their work together, and only then did anyone find out whether it all fit.

It rarely did. Changes contradicted each other in ways no one could see while working alone. Tests that passed on every individual copy failed on the combined code. The team then spent days, sometimes weeks, untangling the mess. This was nicknamed **integration hell**.

You met the cause in [Branching Strategies](/courses/devops/branching-strategies): the longer work stays apart, the more painful it is to bring together. CI attacks that directly. If everyone integrates every day, the code never drifts far apart, and each problem is small and fresh.

Think of a group building a big jigsaw puzzle, each working on a corner at a separate table. If they only bring their pieces together at the end, they discover the corners do not line up. If they check every hour that their edges still fit the middle, they fix tiny gaps as they go.

## Where CI came from

The idea is older than DevOps. **Grady Booch** used the term in 1991. **Extreme Programming** (XP), led by **Kent Beck** in the late 1990s, made it a core practice, and **Martin Fowler**'s widely read article "Continuous Integration" (2000, updated since) spelled out how to do it. Tools followed: CruiseControl in 2001, Hudson (later renamed **Jenkins**) in 2005, and today hosted services such as **GitHub Actions** and **GitLab CI/CD**.

## The core practices

Running a build server is not the same as doing CI. CI is a set of habits, and the tool only supports them:

| Practice | Why it matters |
|---|---|
| **Keep all code in one repository**, in version control | There is one source of truth to build and test ([Version Control with Git](/courses/devops/version-control-with-git)) |
| **Integrate into main at least daily** | Small, frequent merges stay easy; big, rare ones become integration hell |
| **Automate the build** | Anyone, or any machine, can build the project with one command |
| **Make the build self-testing** | A build that compiles but is never tested proves very little |
| **Every push builds main** (or the merge result) | Problems show up within minutes of being written |
| **Fix a broken build immediately** | A red main blocks everyone; fixing it is the team's top priority |
| **Keep the build fast** | Aim for under 10 minutes, so people wait for the result instead of moving on |
| **Everyone can see the results** | A green or red mark next to every commit and pull request |

The most important one is the shortest: **don't leave main broken**. If a change breaks the build, either fix it in minutes or **revert** it, and investigate calmly afterwards.

## What a CI pipeline does

A **CI pipeline** is the list of steps the CI system runs on every push. A typical one for a web app:

```text
push / pull request
      |
      v
1. Check out the code         a fresh, clean machine every time
2. Install dependencies       exact versions from the lock file
3. Lint                       style and common mistakes
4. Build                      compile, bundle, package
5. Test                       unit tests, then integration tests
6. Report                     green tick or red cross on the commit / PR
      |
      v
artifact ready for delivery   (next lessons)
```

A few things make this powerful:

- **A fresh machine every time.** The CI runner starts clean, so "it works on my machine" because of some forgotten local file cannot fool it.
- **The same steps every time.** No one forgets to run the tests on a busy Friday.
- **Fail fast.** Cheap, quick checks such as linting run first; if they fail, the slow steps never start.
- **Pull requests show the result before merging.** Reviewers see whether a change works before they approve it, and [branch protection](/courses/devops/branching-strategies) can block merging until it is green.

## CI tools

The ideas are the same everywhere; the configuration format differs:

| Tool | Where it runs | Configured in |
|---|---|---|
| **GitHub Actions** | GitHub's hosted runners, or your own | `.github/workflows/*.yml` |
| **GitLab CI/CD** | GitLab's runners, or your own | `.gitlab-ci.yml` |
| **Jenkins** | Your own servers | A `Jenkinsfile`, or the web UI |
| **Azure Pipelines** | Microsoft's agents, or your own | `azure-pipelines.yml` |
| **CircleCI**, **Buildkite** and others | Hosted, or hybrid | A YAML file in the repo |

Notice the pattern: the pipeline is defined **in a file in the repository**. Pipeline changes are reviewed and versioned like any other code. This is called **pipeline as code**. In the next lesson you will write one for GitHub Actions.

## Keeping CI fast and trustworthy

A CI pipeline is only useful while people trust it and do not mind waiting for it. Watch out for:

- **Slow builds.** If CI takes 40 minutes, people stop waiting and start stacking changes on an unverified main. Cache dependencies, run independent jobs in parallel, and move very slow tests to a separate, later stage.
- **Flaky tests.** A test that sometimes fails for no real reason (timing, network, test order) teaches everyone to ignore red builds. Fix or quarantine flaky tests quickly. More in [Automated Testing in the Pipeline](/courses/devops/testing-in-the-pipeline).
- **Skipping the pipeline.** "It's a tiny change, I'll push straight to main" is how most broken builds start. Let branch protection enforce the rule.
- **Secrets in logs.** CI systems mask known secrets, but a script that prints its whole environment can still leak them. Treat CI logs as visible to the whole team.

## Seeing CI catch a real problem

The code panel for this lesson has a script that acts out continuous integration with two developers and a tiny "CI server". Every commit lands on `main` and is tested immediately with Node's built-in test runner:

```bash
bash ci-demo.sh
```

```text
1. The project: total() adds up prices in rupees
  [CI] build for 38038e1 "Add total()"
  [CI] PASSED: main is green

2. Asha changes total() to return paise (whole numbers avoid rounding bugs)
  [CI] build for fc313d1 "Return totals in paise"
  [CI] PASSED: main is green

3. Ravi adds receipts. He wrote them last week, against the OLD total()
  [CI] build for 555e278 "Add receipts"
  [CI] FAILED: main is red. Fixing it is now the team's top priority.
  [CI]   actual: 'Total: Rs 35000.00',
  [CI]   expected: 'Total: Rs 350.00',

4. Ravi fixes it minutes later, while the change is still fresh in his mind
  [CI] build for 4c936da "Convert paise to rupees on receipts"
  [CI] PASSED: main is green
```

Your commit IDs will be different. Both developers' changes were correct **on their own**. Asha's tests passed and Ravi's would have passed against the code he started from. The bug only existed when the two were **combined**, which is exactly the kind of problem CI exists to catch. Because they integrated straight away, it was found in seconds and fixed in minutes, not discovered by a customer weeks later as a receipt for ₹35,000.

## Common misunderstandings

### "We have Jenkins, so we do CI"

A CI server running against long-lived branches that merge once a month is just automated integration hell. CI is the **habit** of integrating often; the server only checks the result.

### "CI is only for big teams"

A solo developer still benefits: every push is tested on a clean machine, the history shows which commit broke what, and there is a safety net for the day you are tired.

### "If CI is green, the code is correct"

Green means "the tests we wrote passed". It is only as good as the tests. CI makes good tests run reliably; it cannot write them for you.

## Quick recap

- **Continuous integration** means merging into main at least daily and automatically building and testing every change.
- It replaces painful, late **integration hell** with small, early, cheap fixes.
- Core habits: one repo, frequent merges, automated self-testing builds, fast feedback, and **never leaving main broken**.
- A **CI pipeline** checks out, installs, lints, builds, tests and reports, on a fresh machine every time.
- Pipelines are defined **as code** in the repository.
- Keep CI **fast** and **trustworthy**: cache, parallelise, and fix flaky tests.

Next, you will write a real pipeline in [Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# ci-demo.sh: what a CI server does, in miniature.
# Two developers change the same project. Every push is merged into main and
# tested straight away, so a clash between their changes is caught in seconds.
# Run it with: bash ci-demo.sh   (needs git and Node.js)
set -euo pipefail
rm -rf ci-demo &amp;&amp; mkdir ci-demo &amp;&amp; cd ci-demo
git init --quiet --initial-branch=main
git config user.name "Demo User"
git config user.email "demo@example.com"
# The "CI server": take the latest main, run every test, report green or red.
ci() {
  echo "  [CI] build for $(git rev-parse --short HEAD) \"$(git log -1 --format=%s)\""
  if node --test &gt; ci.log 2&gt;&amp;1; then
    echo "  [CI] PASSED: main is green"
  else
    echo "  [CI] FAILED: main is red. Fixing it is now the team's top priority."
    grep -E "^ +(actual|expected):" ci.log | head -n 2 | sed 's/^ */  [CI]   /'
  fi
}
echo "1. The project: total() adds up prices in rupees"
cat &gt; price.mjs &lt;&lt;'EOF'
export const total = (prices) =&gt; prices.reduce((sum, p) =&gt; sum + p, 0);
EOF
cat &gt; price.test.mjs &lt;&lt;'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { total } from './price.mjs';
test('total adds prices', () =&gt; assert.equal(total([100, 250]), 350));
EOF
git add . &amp;&amp; git commit --quiet -m "Add total()"
ci
echo
echo "2. Asha changes total() to return paise (whole numbers avoid rounding bugs)"
cat &gt; price.mjs &lt;&lt;'EOF'
export const total = (prices) =&gt; Math.round(prices.reduce((sum, p) =&gt; sum + p, 0) * 100);
EOF
sed -i.bak 's/350)/35000)/' price.test.mjs &amp;&amp; rm price.test.mjs.bak
git commit --quiet -am "Return totals in paise"
ci
echo
echo "3. Ravi adds receipts. He wrote them last week, against the OLD total()"
cat &gt; receipt.mjs &lt;&lt;'EOF'
import { total } from './price.mjs';
export const receipt = (prices) =&gt; `Total: Rs ${total(prices).toFixed(2)}`;
EOF
cat &gt; receipt.test.mjs &lt;&lt;'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receipt } from './receipt.mjs';
test('receipt shows rupees', () =&gt; assert.equal(receipt([100, 250]), 'Total: Rs 350.00'));
EOF
git add . &amp;&amp; git commit --quiet -m "Add receipts"
ci
echo
echo "4. Ravi fixes it minutes later, while the change is still fresh in his mind"
sed -i.bak 's/total(prices).toFixed(2)/(total(prices) \/ 100).toFixed(2)/' receipt.mjs &amp;&amp; rm receipt.mjs.bak
git commit --quiet -am "Convert paise to rupees on receipts"
ci
</code></pre>
