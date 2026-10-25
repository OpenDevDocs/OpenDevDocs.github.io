---
publishDate: 2026-10-25T12:10
title: Configuration, Environments and Secrets
slug: configuration-environments-and-secrets
metadescription: Learn how to separate configuration from code, use environment variables the twelve-factor way, validate config at start-up, store secrets in secret managers, use OIDC instead of long-lived CI keys, and respond to a leaked secret.
updateDate: 2026-10-25T12:10
author: ['bishal-biswas']
level: 2
tags: ['devops', 'configuration', 'secrets', 'security', 'twelve-factor']
course: devops
---

## One artifact, many environments

In [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning) you learned to **build once** and deploy the same artifact everywhere. But staging and production are not identical: they use different databases, different API keys, different log levels.

So where do those differences live? Not in the code, and not in the artifact. They live in **configuration**, supplied from outside when the app starts. Getting this right is what makes build-once possible, and getting **secrets** right is one of the most important security skills in DevOps.

## Configuration vs code

**Configuration** is everything that is likely to change **between deployments** of the same code:

- addresses of backing services: databases, caches, other APIs;
- credentials: passwords, API keys, tokens;
- per-environment settings: log level, the public URL, feature flags;
- tuning: pool sizes, timeouts.

A simple test: **could you make this repository public right now without leaking anything?** If not, configuration (or worse, secrets) is mixed into your code.

Things that are the **same** everywhere, such as how routes map to handlers, are not configuration. They are just code.

## The twelve-factor way: environment variables

The **Twelve-Factor App**, a well-known set of principles for building cloud apps published by engineers at Heroku in 2011, says: **store config in the environment**. That means **environment variables**, which you met in [Essential Shell Commands and Bash Scripting](/courses/devops/shell-essentials).

Environment variables work everywhere, with every language and every platform:

| Where the app runs | How environment variables are set |
|---|---|
| Your laptop | `export PORT=8080`, or a git-ignored `.env` file |
| Docker | `docker run -e PORT=8080` or `--env-file` |
| Docker Compose | `environment:` and `env_file:` ([Compose](/courses/devops/docker-compose-basics)) |
| Kubernetes | `env:` from **ConfigMaps** and **Secrets** ([Why Kubernetes?](/courses/devops/why-kubernetes)) |
| GitHub Actions | `env:` with `vars.*` and `secrets.*` |
| PaaS and serverless | The platform's "environment variables" settings page |

In Node.js the app reads `process.env.DATABASE_URL`; in Python `os.environ["DATABASE_URL"]`; every language has an equivalent.

Config **files** are fine too, especially for large, structured settings, as long as the file is supplied by the environment (mounted at deploy time) rather than baked into the artifact.

### Precedence

Most apps combine several sources. The usual rule is that **more specific wins**:

```text
built-in defaults   <   config file   <   .env file   <   real environment variables   <   command-line flags
(lowest priority)                                                                          (highest)
```

So a default of `PORT=3000` can be overridden by a `.env` file for local development, and both are overridden by `PORT=8080` set by the platform in production.

## Validate configuration at start-up

A missing or mistyped setting should stop the app **immediately, at start-up**, with a clear message. Not twenty minutes later, when the first customer tries to pay and the payment key turns out to be empty.

Good start-up validation:

- checks **every** setting once, and reports **all** problems together;
- converts types: `"8080"` to the number `8080`, `"true"` to a boolean;
- rejects nonsense: a port of 99999, a log level of `"verbose"`;
- **never prints secrets**, even when logging the loaded config.

This is called **failing fast**. Combined with the [readiness probes](/courses/devops/why-kubernetes) and [smoke tests](/courses/devops/testing-in-the-pipeline) from earlier lessons, a misconfigured release never receives traffic.

## Environments

Most teams run the same app in several environments:

| Environment | Purpose | Data |
|---|---|---|
| **Development** | Each developer's own machine | Fake or seeded test data |
| **CI / test** | Automated tests, created fresh for each run | Throwaway test data |
| **Staging** | Final check, as close to production as possible | Realistic but not real customer data |
| **Production** | Real users | Real data |

The closer staging is to production, the more it can catch. Aim for **environment parity**: the same artifact, the same versions of the database and other services, the same infrastructure code ([Infrastructure as Code](/courses/devops/infrastructure-as-code)), with only the configuration different.

> **Note:** Do not copy real production data into lower environments without thinking about privacy. Customer data in a test database is still customer data, and test environments are usually less protected. Use anonymised or generated data.

## Secrets

A **secret** is configuration that would cause harm if someone else saw it: database passwords, API keys, private keys, signing keys, tokens. Secrets need extra care because they are **valuable to attackers**, and leaked secrets are one of the most common causes of breaches.

### Where secrets must never go

- **Source code** and committed config files.
- **Git history**: deleting a secret in a later commit does not remove it from history ([Version Control with Git](/courses/devops/version-control-with-git)).
- **Container images**: every layer can be read by anyone who can pull the image ([Docker Essentials](/courses/devops/docker-essentials)).
- **Logs** and error messages.
- **Chat messages, tickets and wikis.**
- **cloud-init user data** and other places visible to anyone who can view a resource's settings.

### Where secrets should go: secret managers

A **secret manager** is a service built to store secrets safely. It encrypts them, controls exactly who and what can read each one, logs every access, and supports **rotation** (changing a secret regularly or after an incident).

| Secret manager | Where |
|---|---|
| **HashiCorp Vault** / **OpenBao** | Self-hosted or managed, works anywhere |
| **AWS Secrets Manager** / **SSM Parameter Store** | AWS |
| **Azure Key Vault** | Azure |
| **Google Secret Manager** | Google Cloud |
| **GitHub Actions secrets** | Pipelines on GitHub |
| **Kubernetes Secrets**, often filled by the **External Secrets Operator** from one of the above | Kubernetes |

A common pattern: secrets live in the cloud's secret manager, and the platform injects them into the app as environment variables or files at start-up. The app only ever sees the value it needs, and the secret is changed in one place.

> **Tip:** Some teams keep secrets in Git **encrypted**, with tools such as **SOPS**, so the encrypted file can be reviewed and versioned like everything else while only authorised people and pipelines can decrypt it.

### Least privilege and short lives

- Give each app and each environment its **own** credentials, with only the permissions it needs. Staging's database password should not work on production.
- Prefer **short-lived** credentials that expire on their own, over long-lived keys that work forever if leaked.
- **Rotate** secrets regularly, and immediately when someone with access leaves the team.

## OIDC: pipelines without stored cloud keys

Pipelines need access to the cloud to deploy. The old way was to create a long-lived cloud access key and store it as a CI secret. If it ever leaked, it worked until someone noticed and deleted it.

The modern way is **OpenID Connect** (OIDC). GitHub Actions (and GitLab, and others) can prove to your cloud provider "I am a workflow running in repository `your-name/recipe-api`, on branch `main`". You configure the cloud to trust that, and it hands the job **temporary credentials** that expire within an hour. There is no stored key to leak.

```yaml
permissions:
  id-token: write          # allow the job to request an OIDC token
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/recipe-api-deploy
          aws-region: ap-south-1
      - run: aws sts get-caller-identity     # temporary credentials, valid for this job only
```

On the AWS side, the `recipe-api-deploy` role trusts GitHub's OIDC provider, restricted to that repository and branch, and has only the permissions the deployment needs. Azure and Google Cloud support the same idea, called **workload identity federation**.

## When a secret leaks

It will happen eventually: a key pasted into a public repo, a `.env` committed by mistake, a token printed in a CI log. What to do, in order:

1. **Revoke or rotate it immediately.** Assume it has already been copied. Bots scan public GitHub for keys within minutes, so this comes **before** cleaning up the repository.
2. **Check for misuse.** Look at the provider's access logs and your bill for unusual activity.
3. **Then remove it** from the code and, if needed, rewrite history, knowing that clones and forks may still have it.
4. **Learn from it.** Why was the secret somewhere it could leak? Hold a [blameless postmortem](/courses/devops/incident-response-and-postmortems).

To catch leaks **before** they happen, turn on **secret scanning**: GitHub's secret scanning and push protection block commits containing known key formats, and tools such as **gitleaks** do the same in CI or as a [pre-commit hook](/courses/devops/devops-principles).

## A start-up config check you can run

The code panel for this lesson has a Node.js config loader that does everything this lesson recommends. It:

- loads a local `.env` file if there is one, using Node's built-in `process.loadEnvFile()`;
- checks every setting against a small **schema**: type, allowed values, default, required, secret;
- refuses to start, listing **all** problems at once, if anything is wrong;
- prints the final config with **secrets masked**.

With no configuration at all, it refuses to start:

```bash
node config.mjs
```

```text
Refusing to start: configuration is invalid
  - DATABASE_URL is required but not set
  - PAYMENT_API_KEY is required but not set
```

With `--demo`, it writes a sample `.env.demo` file and loads it:

```bash
node config.mjs --demo
```

```text
Configuration loaded for staging:
  APP_ENV            staging
  PORT               8080
  LOG_LEVEL          info
  DATABASE_URL       post****
  PAYMENT_API_KEY    demo****
  FEATURE_DARK_MODE  true
```

Notice `LOG_LEVEL` is `info`: it was not in the file, so the default applied. Now try bad values set in the real environment:

```bash
PORT=99999 LOG_LEVEL=verbose node config.mjs --demo
```

```text
Refusing to start: configuration is invalid
  - PORT must be a port number, got "99999"
  - LOG_LEVEL must be one of debug, info, warn, error, got "verbose"
```

This also shows **precedence** in action: the file says `PORT=8080`, but `process.loadEnvFile()` never overwrites a variable that is already set, so the real environment variable won, exactly as the precedence rule says.

## Common misunderstandings

### "Environment variables are secure"

They keep secrets out of code, which is a big improvement, but they are not a vault. Other processes on the machine, crash reports and debugging tools can sometimes read them. For the most sensitive values, many platforms mount secrets as files with strict permissions instead, and a secret manager remains the source of truth.

### "A private repository is a safe place for secrets"

Private repositories get cloned onto laptops, shared with contractors, connected to third-party tools, and sometimes accidentally made public. Treat every repository as if it might become public one day.

### "We will clean up the config later"

Hard-coded settings spread quickly and are painful to find later. Separating config from code on day one costs a few minutes.

## Quick recap

- **Configuration** is whatever changes between deployments; keep it **out of the code and the artifact**.
- Follow the **twelve-factor** rule: config comes from **environment variables** (or mounted files), with clear **precedence**.
- **Validate config at start-up** and fail fast, reporting every problem at once and never printing secrets.
- Keep **environments** as alike as possible: same artifact, same infrastructure code, different config.
- Store **secrets** in a **secret manager**, with least privilege, short lives and rotation; never in code, images or logs.
- Use **OIDC** so pipelines get temporary cloud credentials instead of stored keys.
- If a secret leaks: **revoke first**, then investigate and clean up.

That completes **Cloud and Infrastructure as Code**. Next, you will learn to see what your running systems are doing in [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting).

<code id="code-content" class="language-javascript">
// config.mjs: load, check and safely print an app's configuration at start-up.
// Settings come from environment variables (optionally a local .env file),
// are checked once, and the app refuses to start if anything is missing or wrong.
// Run it with: node config.mjs           (missing secrets: it fails, on purpose)
//          or: node config.mjs --demo    (writes a sample .env.demo and loads it)
import { existsSync, writeFileSync } from 'node:fs';
if (process.argv.includes('--demo')) {
  writeFileSync('.env.demo', [
    'APP_ENV=staging',
    'PORT=8080',
    'DATABASE_URL=postgres://recipes:s3cr3t-pa55@db.internal:5432/recipes',
    'PAYMENT_API_KEY=demo-payment-key-not-real',
    'FEATURE_DARK_MODE=true',
  ].join('\n'));
  process.loadEnvFile('.env.demo');             // built into Node: no package needed
} else if (existsSync('.env')) {
  process.loadEnvFile('.env');                  // local development only; never commit it
}
// Every setting the app understands: its type, default, and whether it is secret
const schema = {
  APP_ENV:           { type: 'enum', values: ['development', 'staging', 'production'], default: 'development' },
  PORT:              { type: 'port', default: 3000 },
  LOG_LEVEL:         { type: 'enum', values: ['debug', 'info', 'warn', 'error'], default: 'info' },
  DATABASE_URL:      { type: 'url', required: true, secret: true },
  PAYMENT_API_KEY:   { type: 'string', required: true, secret: true },
  FEATURE_DARK_MODE: { type: 'boolean', default: false },
};
function parse(name, rule, raw) {
  switch (rule.type) {
    case 'port': {
      const n = Number(raw);
      if (!Number.isInteger(n) || n &lt; 1 || n &gt; 65535) throw new Error(`${name} must be a port number, got "${raw}"`);
      return n;
    }
    case 'boolean':
      if (!['true', 'false'].includes(raw)) throw new Error(`${name} must be true or false, got "${raw}"`);
      return raw === 'true';
    case 'enum':
      if (!rule.values.includes(raw)) throw new Error(`${name} must be one of ${rule.values.join(', ')}, got "${raw}"`);
      return raw;
    case 'url':
      try { return new URL(raw).href; } catch { throw new Error(`${name} must be a URL`); }
    default:
      return raw;
  }
}
// Check EVERYTHING first, then report every problem at once
const config = {};
const problems = [];
for (const [name, rule] of Object.entries(schema)) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    if (rule.required) problems.push(`${name} is required but not set`);
    else config[name] = rule.default;
    continue;
  }
  try { config[name] = parse(name, rule, raw); } catch (err) { problems.push(err.message); }
}
if (problems.length) {
  console.error('Refusing to start: configuration is invalid');
  problems.forEach((p) =&gt; console.error(`  - ${p}`));
  process.exit(1);
}
// Safe to log: secrets are masked, so logs never leak them
const masked = (value) =&gt; `${String(value).slice(0, 4)}****`;
console.log(`Configuration loaded for ${config.APP_ENV}:`);
for (const [name, value] of Object.entries(config)) {
  console.log(`  ${name.padEnd(18)} ${schema[name].secret ? masked(value) : value}`);
}
</code></pre>
