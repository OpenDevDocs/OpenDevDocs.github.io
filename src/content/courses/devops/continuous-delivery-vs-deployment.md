---
publishDate: 2026-10-25T11:30
title: Continuous Delivery vs Continuous Deployment
slug: continuous-delivery-vs-deployment
metadescription: Learn the difference between continuous delivery and continuous deployment, how a deployment pipeline promotes one artifact through environments, approvals with GitHub environments, push vs pull deployments and fast rollbacks.
updateDate: 2026-10-25T11:30
author: ['bishal-biswas']
level: 2
tags: ['devops', 'ci-cd', 'continuous-delivery', 'deployment', 'github-actions']
course: devops
---

## Two "CD"s

You will see **CI/CD** everywhere. The **CI** is clear: [continuous integration](/courses/devops/continuous-integration). The **CD** is confusing, because it stands for two different, closely related things:

| | Continuous **Delivery** | Continuous **Deployment** |
|---|---|---|
| Every change that passes the pipeline... | ...is **ready** to go to production | ...**goes** to production |
| The final step to production | A person decides, with one click | Automatic, no human |
| Production deploys happen | Whenever the business chooses: daily, weekly, on demand | Many times a day, as changes land |

Put as a chain:

```text
                      Continuous Integration
commit ──> build ──> test ──┐
                            │  Continuous Delivery
                            └──> deploy to staging ──> [ human clicks "approve" ] ──> production
                            │
                            │  Continuous Deployment
                            └──> deploy to staging ──> automatic checks ─────────────> production
```

The only technical difference is that one button. But the button changes a lot about how a team works, so it is worth understanding both.

## Continuous delivery

**Continuous delivery** was described by Jez Humble and David Farley in their 2010 book *Continuous Delivery*. The core idea:

> Your software is **always in a releasable state**, and releasing it is a routine, low-risk, push-button decision.

Every change goes through the same automated pipeline. If it passes, the artifact is deployed to staging and sits there, ready. Getting it to production takes one click, not a weekend of checklists. Deciding **when** to click is a business decision ("release before the marketing email goes out"), not a technical project.

Continuous delivery is a great fit when:

- someone must sign off releases, for legal, regulatory or contractual reasons;
- releases must line up with something outside engineering, such as a launch date, app store review or customer training;
- the team is still building up the test coverage and monitoring it would need to remove the human step.

## Continuous deployment

**Continuous deployment** goes one step further: **every** change that passes all the automated checks is deployed to production, with no human in the loop. A developer merges a pull request, and a few minutes later it is live.

That sounds scary, but teams that do it well find it **less** risky, because:

- each deployment contains one small change, so it is easy to understand and to undo;
- deploying is so routine that the process is very well tested;
- problems show up minutes after a change, while its author still remembers every detail.

It does need strong foundations:

- **trustworthy automated tests** ([Automated Testing in the Pipeline](/courses/devops/testing-in-the-pipeline));
- **good monitoring and alerts**, to spot problems the tests missed ([Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting));
- **fast, practised rollback**;
- **feature flags**, so unfinished features can be deployed while switched off ([Branching Strategies](/courses/devops/branching-strategies)).

> **Note:** Continuous deployment does not mean every **feature** goes live the moment its code merges. With feature flags, code is **deployed** continuously, but a feature is **released** when someone turns its flag on. You met this distinction in [The Software Delivery Lifecycle](/courses/devops/software-delivery-lifecycle).

## The deployment pipeline

Both styles use a **deployment pipeline**: a series of stages, each giving more confidence than the last. A change only moves to the next stage if it passed the previous one. This is called **promotion**.

| Stage | What happens | Confidence gained |
|---|---|---|
| **Commit stage** | Lint, unit tests, build the artifact | "The code is sound" |
| **Acceptance stage** | Integration and end-to-end tests against the artifact | "The features work" |
| **Staging** | Deploy to a production-like environment; smoke tests | "It deploys and runs correctly" |
| **Production** | Deploy (after approval, or automatically); smoke tests; monitoring | "Users have it, and it is healthy" |

The **same artifact** moves through every stage, as you learned in [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning). Only the configuration changes.

## Environments and approvals in GitHub Actions

GitHub Actions supports this directly with **environments**. You create them in **Settings → Environments**, for example `staging` and `production`, and each one can have:

- its own **secrets** and **variables**, so the same workflow step deploys to a different server depending on the environment;
- **required reviewers**: named people or teams who must approve before a job using that environment can start;
- a **wait timer**, such as "wait 10 minutes after staging";
- **deployment branch rules**, such as "only `main` may deploy to production".

A job opts in with one line:

```yaml
  production:
    needs: staging
    environment: production
```

When the workflow reaches that job, it **pauses**. The reviewers get a notification and see a **Review deployments** button on the run. Once someone approves, the job starts, using production's own secrets.

To switch from continuous delivery to continuous deployment, you do not change the workflow at all: you just remove the required reviewers from the `production` environment.

> **Tip:** Environment protection rules such as required reviewers are available for public repositories on every plan; for private repositories, what you can use depends on your GitHub plan. Check before relying on them.

## How the code reaches the server

There are two broad ways to deploy:

### Push-based

The pipeline itself connects to the target and **pushes** the new version: copying files over SSH, calling a cloud provider's command-line tool, or running `kubectl apply`. It is simple and easy to follow, and it is what this lesson's code panel does. The downside is that the pipeline needs credentials for production.

### Pull-based (GitOps)

A tool running **inside** the target environment, such as **Argo CD** or **Flux** in Kubernetes, watches a Git repository describing what should be running. When the repository changes, the tool **pulls** the change and applies it. The pipeline's only job is to update the repository. Production credentials never leave production, and Git becomes the full history of every deployment. You will meet this again with [Kubernetes](/courses/devops/why-kubernetes).

## Fast rollback by design

Every deployment process needs a way back. A simple, effective pattern for servers is **release folders plus a symlink**:

```text
/var/www/app/
├── releases/
│   ├── 20261024-56b35dd/
│   ├── 20261025-3ef9d3a/
│   └── 20261025-af63aec/      <- newest
└── current -> releases/20261025-af63aec
```

Each deployment uploads into a **new** folder and then switches the `current` link to point at it. The web server always serves from `current`. Rolling back is just pointing the link at the previous folder:

```bash
ln -sfn /var/www/app/releases/20261025-3ef9d3a /var/www/app/current
```

The switch takes a moment, and the old versions are still there, untouched. Tools such as Capistrano and Deployer have used this pattern for years, and container platforms do the same thing with image tags.

Two words you will hear:

- **Roll back:** return to the previous version. Fast and safe when the last version was good.
- **Roll forward:** fix the problem and deploy a new version instead. Common when changes are small and the pipeline is fast, or when going back is not possible, for example after a database change.

## A complete delivery workflow

The code panel for this lesson has a full GitHub Actions workflow for continuous delivery. On every push to `main` it:

1. **builds and tests** once, names the release (date plus commit, such as `20261025-3ef9d3a`) and uploads the artifact;
2. **deploys to staging** automatically: uploads the files with `rsync` into a new release folder, switches the `current` link, and runs a **smoke test** against `/health`;
3. **waits for approval**, then deploys the **same** artifact to **production** the same way.

To use it, create two environments in your repository's settings:

| Setting | `staging` | `production` |
|---|---|---|
| Secret `DEPLOY_SSH_KEY` | Private key for the staging server's `deploy` user | Private key for the production server |
| Variable `DEPLOY_HOST` | Staging server's address | Production server's address |
| Variable `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan <staging-host>`, checked once by hand | The same, for production |
| Required reviewers | None | You, or your team |

The workflow sets `concurrency` with `cancel-in-progress: false`, so deployments queue up one after another and are never cancelled half-way.

> **Note:** Storing the server's fingerprint in `DEPLOY_KNOWN_HOSTS` means the pipeline refuses to connect if the server's identity ever changes, the same protection you learned about in [SSH, Users and Permissions on a Server](/courses/devops/ssh-users-and-permissions). Skipping host checks in CI is a common, risky shortcut.

## Which should you choose?

| If... | Choose |
|---|---|
| Releases need sign-off or must line up with outside events | Continuous delivery |
| Tests or monitoring are not yet trusted enough to remove the human | Continuous delivery, and work towards deployment |
| You have strong tests, monitoring, feature flags and fast rollback | Continuous deployment |
| You ship a mobile or desktop app through an app store | Continuous delivery to the store's testing track; a person submits the release |

Most teams start with continuous delivery. As confidence grows, the approval click starts to feel like a formality, which is the sign to consider removing it.

## Common misunderstandings

### "Continuous delivery means we deploy to production constantly"

That is continuous **deployment**. Continuous delivery means you **could** deploy at any moment; how often you actually do is a choice.

### "A manual approval makes deployments safe"

An approver clicking "yes" on a 200-change release cannot really check it. Safety comes from small changes, good tests, monitoring and rollback. The approval is a business decision point, not a quality check.

### "We need a release weekend for big changes"

Big, rare releases are exactly what make releases risky. Break the change down, hide unfinished parts behind flags, and deploy in small steps.

## Quick recap

- **Continuous delivery:** every passing change is ready for production; a person decides when to release, with one click.
- **Continuous deployment:** every passing change goes to production automatically.
- A **deployment pipeline** promotes the **same artifact** through stages: commit, acceptance, staging, production.
- **GitHub environments** add per-environment secrets, required reviewers, wait timers and branch rules.
- Deploys can be **push-based** (the pipeline deploys) or **pull-based** (GitOps tools pull from Git).
- Design for **fast rollback**: release folders and a `current` link, or immutable image tags.

Next, you will learn how to switch versions without users noticing in [Deployment Strategies: Rolling, Blue-Green and Canary](/courses/devops/deployment-strategies).

<code id="code-content" class="language-yaml">
# .github/workflows/deploy.yml: continuous delivery with GitHub environments.
# Every push to main is built and tested once, deployed to staging automatically,
# then WAITS for approval before the very same files go to production.
# For continuous DEPLOYMENT, remove "Required reviewers" from the production environment.
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
# Run deployments one at a time, and never cancel one half-way
concurrency:
  group: deploy
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      release: ${{ steps.name.outputs.release }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - id: name
        run: echo "release=$(date +%Y%m%d)-${GITHUB_SHA::7}" &gt;&gt; "$GITHUB_OUTPUT"
      - uses: actions/upload-artifact@v4
        with:
          name: app
          path: dist/
  staging:
    needs: build
    runs-on: ubuntu-latest
    # Secrets and variables below come from the "staging" environment's settings
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: app
          path: dist/
      - name: Upload the release and switch to it
        env:
          SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          HOST: ${{ vars.DEPLOY_HOST }}
          KNOWN_HOSTS: ${{ vars.DEPLOY_KNOWN_HOSTS }}
          RELEASE: ${{ needs.build.outputs.release }}
        run: |
          mkdir -p ~/.ssh &amp;&amp; chmod 700 ~/.ssh
          echo "$SSH_KEY" &gt; ~/.ssh/id_ed25519 &amp;&amp; chmod 600 ~/.ssh/id_ed25519
          echo "$KNOWN_HOSTS" &gt; ~/.ssh/known_hosts
          rsync -az dist/ "deploy@$HOST:/var/www/app/releases/$RELEASE/"
          ssh "deploy@$HOST" "ln -sfn /var/www/app/releases/$RELEASE /var/www/app/current"
      - name: Smoke test
        run: curl -fsS --retry 5 --retry-delay 3 https://staging.example.com/health
  production:
    needs: [build, staging]
    runs-on: ubuntu-latest
    # The "production" environment has Required reviewers, so the run pauses here
    environment:
      name: production
      url: https://example.com
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: app
          path: dist/
      - name: Upload the release and switch to it
        env:
          SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          HOST: ${{ vars.DEPLOY_HOST }}
          KNOWN_HOSTS: ${{ vars.DEPLOY_KNOWN_HOSTS }}
          RELEASE: ${{ needs.build.outputs.release }}
        run: |
          mkdir -p ~/.ssh &amp;&amp; chmod 700 ~/.ssh
          echo "$SSH_KEY" &gt; ~/.ssh/id_ed25519 &amp;&amp; chmod 600 ~/.ssh/id_ed25519
          echo "$KNOWN_HOSTS" &gt; ~/.ssh/known_hosts
          rsync -az dist/ "deploy@$HOST:/var/www/app/releases/$RELEASE/"
          ssh "deploy@$HOST" "ln -sfn /var/www/app/releases/$RELEASE /var/www/app/current"
      - name: Smoke test
        run: curl -fsS --retry 5 --retry-delay 3 https://example.com/health
</code></pre>
