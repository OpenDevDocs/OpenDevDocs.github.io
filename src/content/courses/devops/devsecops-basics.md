---
publishDate: 2026-10-25T12:25
title: 'DevSecOps: Security in the Pipeline'
slug: devsecops-basics
metadescription: Learn DevSecOps, shifting security left with threat modelling, SAST, dependency scanning, secret scanning, container and IaC scanning, DAST, SBOMs, signing and protecting the software supply chain, with a complete GitHub Actions security workflow.
updateDate: 2026-10-25T12:25
author: ['bishal-biswas']
level: 3
tags: ['devops', 'devsecops', 'security', 'supply-chain', 'ci-cd']
course: devops
---

## Security cannot be the last step

In the old world, security worked like the old operations team in [What is DevOps?](/courses/devops/what-is-devops). Developers built for months, then handed the finished product to a separate security team for a review just before launch. The review found problems, the launch slipped, and everyone was unhappy. Or the review was skipped because of the deadline.

That does not work when you deploy many times a day. Nobody can manually review a change that will be live in twenty minutes.

**DevSecOps** means building security into **every** stage of the delivery loop, mostly through **automation**, and making it **everyone's** responsibility, not only the security team's. The security team's job shifts from gatekeeper to **enabler**: providing the tools, guidance and safe defaults that let every team move fast and safely.

## Shift left, but also right

You met **shifting left** in [DevOps Principles](/courses/devops/devops-principles): finding problems earlier, when they are cheapest to fix. For security, that looks like this:

| Stage | Security practice | Catches |
|---|---|---|
| **Plan** | Threat modelling | Design flaws, before any code exists |
| **Code** | Editor plugins, pre-commit secret checks | Leaked keys, risky patterns, as you type |
| **Build** | SAST, dependency scanning (SCA), secret scanning | Vulnerable code and libraries |
| **Package** | Container image and IaC scanning, SBOM, signing | Vulnerable base images, open firewall rules, tampering |
| **Test** | DAST against a running test environment | Problems only visible at run time |
| **Deploy** | Admission policies, only signed images allowed | Untrusted or misconfigured releases |
| **Operate** | Patching, monitoring, alerts, incident response | Attacks and newly discovered vulnerabilities |

The last row is the "shift right" half: new vulnerabilities are found in old code every day, so security never finishes at release.

## Threat modelling

Before building something, spend half an hour asking: **what could go wrong, and what will we do about it?** That is **threat modelling**. A simple version:

1. **Draw it.** Sketch the system: users, services, databases, third parties, and the arrows between them.
2. **Ask what could go wrong.** Microsoft's **STRIDE** checklist helps:

| Letter | Threat | Example question |
|---|---|---|
| **S** | Spoofing | Can someone pretend to be another user or service? |
| **T** | Tampering | Can someone change data in transit or at rest? |
| **R** | Repudiation | Could someone deny doing something, with no record to prove it? |
| **I** | Information disclosure | Can someone see data they should not? |
| **D** | Denial of service | Can someone make it unavailable? |
| **E** | Elevation of privilege | Can someone gain more access than they were given? |

3. **Decide what to do** about each real risk: fix it, reduce it, or accept it on purpose.
4. **Revisit** it when the design changes.

The **OWASP Top 10**, a regularly updated list of the most critical web application risks, is a good companion. It includes problems such as broken access control, injection, security misconfiguration and vulnerable components.

## The automated checks

Each kind of scanner looks at a different thing. You want several of them, because each one is blind to what the others see.

### SAST: scanning your code

**Static Application Security Testing** reads your **source code** without running it, looking for dangerous patterns: SQL built by joining strings, user input passed to a shell command, weak cryptography. Examples: **CodeQL** (free for public repositories on GitHub), **Semgrep**, **SonarQube**.

SAST finds problems early, but produces some **false positives**. Tune the rules, and treat findings like code review comments, not like a broken build, until the noise is under control.

### SCA: scanning your dependencies

Most of the code in a modern app was written by **someone else**: a typical Node.js project has hundreds of dependencies. **Software Composition Analysis** checks them against databases of known vulnerabilities (**CVEs**).

```bash
npm audit                       # report known vulnerabilities in dependencies
npm audit --audit-level=high    # exit with an error only for high or critical ones
```

On the `recipe-api` project from earlier lessons:

```text
found 0 vulnerabilities
```

Run it in the pipeline, not just once: a dependency that is safe today may have a vulnerability announced tomorrow. To keep dependencies **up to date** automatically, enable **Dependabot** (or **Renovate**), which opens pull requests for new versions, which your CI pipeline then tests:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: docker           # base images in the Dockerfile
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions   # the actions your workflows use
    directory: /
    schedule:
      interval: weekly
```

Small, regular updates are far easier than a giant upgrade every two years, the same small-batches idea as everywhere else in DevOps.

### Secret scanning

You learned in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets) that leaked keys are one of the most common causes of breaches. Scanners catch them:

- **GitHub secret scanning and push protection** recognise the formats of hundreds of providers' keys and **block the push** before the secret ever reaches the server. Turn them on in your repository's security settings.
- **gitleaks** and **TruffleHog** do the same in any CI system, or as a [pre-commit hook](/courses/devops/devops-principles) on your own machine.

> **Tip:** Use obviously fake placeholders in documentation and tests, such as `demo-payment-key-not-real`. Realistic-looking fake keys trigger the scanners just like real ones, and teach everyone to ignore their warnings.

### Container image scanning

A container image includes a whole operating system's worth of packages from its **base image**. Scanners such as **Trivy** and **Grype** list everything inside and check it for known vulnerabilities. The fix is usually simple: rebuild on a newer base image, or switch to a smaller one with fewer packages ([Docker Essentials](/courses/devops/docker-essentials)).

### IaC scanning

**Trivy** (in `config` mode), **Checkov** and similar tools read your Dockerfiles, Kubernetes manifests and Terraform files for risky settings before anything is created: a storage bucket open to the public, SSH allowed from `0.0.0.0/0`, a container running as root, a database without encryption. It is the cheapest possible moment to catch a misconfiguration.

### DAST: testing the running app

**Dynamic Application Security Testing** attacks a **running** copy of your app from the outside, like an automated penetration tester: trying injection payloads, checking security headers, probing for exposed admin pages. **OWASP ZAP** is a popular free tool. Run it against **staging**, never against production without permission and care.

## The software supply chain

Your software is built from code, dependencies, base images, build tools and CI actions, all coming from somewhere. Attackers increasingly target that **supply chain**, because compromising one popular component reaches thousands of victims at once. Some real examples:

- **Log4Shell** (December 2021): a critical flaw in Log4j, a Java logging library used almost everywhere. Organisations spent weeks just finding out **where** they used it.
- **xz utils** (2024): a backdoor was patiently slipped into a widely used compression library by an attacker who had spent around two years earning the maintainers' trust. An engineer noticed it only because SSH logins had become slightly slower.
- **tj-actions/changed-files** (March 2025): attackers took over a popular GitHub Action and changed its version tags to point at malicious code, which printed CI secrets into build logs across thousands of repositories.

Defences:

- **Know what you ship.** Generate an **SBOM** (Software Bill of Materials), in the **SPDX** or **CycloneDX** format, for every artifact. When the next Log4Shell is announced, you can answer "are we affected?" in minutes. Tools: **Syft**, **Trivy**.
- **Sign what you build.** Sign images and artifacts in the pipeline, for example with **Sigstore's cosign**, and only allow signed images to be deployed. That proves an artifact came from your pipeline and was not swapped on the way ([Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning)).
- **Pin what you depend on.** Lock files for packages; specific image tags or digests; and for third-party GitHub Actions, a full commit SHA instead of a tag, because a tag can be moved and a commit cannot:

```yaml
      # A tag such as @v2 can be moved to different code by whoever controls the action.
      # A full commit SHA always means exactly the same code.
      - uses: some-org/some-action@<full 40-character commit SHA>   # v2.3.1
```

- **Limit what the pipeline can do.** Minimal `permissions:` on every workflow, short-lived **OIDC** credentials instead of stored keys, and branch protection so nobody can change workflows without review ([Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline)).

The **SLSA** framework ("Supply-chain Levels for Software Artifacts") describes these practices as levels you can work up through, from "the build is scripted" to "builds are tamper-resistant and every artifact has verifiable provenance".

## Security in operation

Shifting left does not replace protecting what is running:

- **Patch regularly**: operating systems, base images, dependencies. Automate as much as you can, such as unattended upgrades from the [cloud-init lesson](/courses/devops/cloud-computing-basics), and Dependabot.
- **Least privilege everywhere**: users, service accounts, IAM roles, database users, Kubernetes pods ([SSH, Users and Permissions](/courses/devops/ssh-users-and-permissions)).
- **Network segmentation**: databases on private subnets, only necessary ports open ([Cloud Computing Basics](/courses/devops/cloud-computing-basics)).
- **Watch for attacks**: security-relevant logs and alerts, such as repeated failed logins or unusual access patterns, feed into the same monitoring and [incident response](/courses/devops/incident-response-and-postmortems) process as everything else.

## A complete security workflow

The code panel for this lesson is a GitHub Actions workflow that adds automated security checks to the `recipe-api` project. It runs on every pull request, on every push to `main`, and **every Monday**, because new vulnerabilities are discovered in unchanged code all the time. It has three jobs that run in parallel:

| Job | Checks | Tools |
|---|---|---|
| `dependencies` | Known-vulnerable packages, and **new** vulnerable dependencies introduced by a pull request | `npm audit`, GitHub's dependency review action |
| `code` | Risky patterns in your own JavaScript | CodeQL, with results in the repository's **Security** tab |
| `image-and-config` | Vulnerabilities in the built image, misconfigurations in the Dockerfile and Terraform, plus an **SBOM** | Trivy, Syft (via `anchore/sbom-action`) |

A few details worth noticing:

- Each job only gets the **permissions** it needs; only `code` may write security results.
- The image scan uses `ignore-unfixed: true`, so the build fails only on vulnerabilities that **have a fix available**. Failing on problems nobody can fix yet just teaches people to ignore the pipeline.
- The final comment is a reminder to **pin third-party actions to commit SHAs** in real projects.

> **Note:** CodeQL code scanning and dependency review are free for public repositories. On private repositories they need GitHub's paid security features; the other jobs work everywhere.

## Common misunderstandings

### "Security scanners make us secure"

Scanners catch **known** kinds of problems. They do not find a design that lets any user read any other user's orders. Threat modelling, code review and secure defaults still matter.

### "Every finding must block the build"

Blocking on hundreds of low-severity or unfixable findings trains everyone to ignore the tools. Block on what is serious and fixable, track the rest, and tighten the rules over time.

### "Security slows DevOps down"

Late, manual security slows everything down. Automated, early security mostly runs in the background of the pipeline you already have, and it is far cheaper than an incident.

## Quick recap

- **DevSecOps** builds security into every stage of delivery, mostly through automation, and makes it everyone's job.
- **Shift left** (threat modelling, scanning in CI) and **shift right** (patching, monitoring, response).
- Use several scanners: **SAST** (your code), **SCA** (dependencies), **secret scanning**, **image** and **IaC** scanning, and **DAST** (the running app).
- Keep dependencies current with **Dependabot** or **Renovate**.
- Protect the **supply chain**: SBOMs, signing, pinning actions to commit SHAs, minimal pipeline permissions and OIDC.
- Block on serious, fixable findings; keep the rest visible and improve over time.

That completes **Operations and Security**. In the final lesson, you will put the whole course together in [Capstone: From Commit to Production](/courses/devops/capstone-commit-to-production).

<code id="code-content" class="language-yaml">
# .github/workflows/security.yml: automated security checks for recipe-api.
# Runs on every pull request, on main, and weekly: new vulnerabilities are
# found in old code all the time, even when nobody changed it.
name: Security
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1"                     # Mondays 06:00 UTC
permissions:
  contents: read
jobs:
  dependencies:                              # SCA: known-vulnerable packages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      - run: npm ci
      - run: npm audit --audit-level=high    # fail on high or critical vulnerabilities
      # On pull requests: block NEW vulnerable dependencies before they are merged
      - if: github.event_name == 'pull_request'
        uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
  code:                                      # SAST: risky patterns in our own code
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write                 # publish results to the repo's Security tab
    steps:
      - uses: actions/checkout@v5
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3
  image-and-config:                          # container image, Dockerfile and Terraform
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: docker build -t recipe-api:${{ github.sha }} .
      - name: Scan the image for known vulnerabilities
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: recipe-api:${{ github.sha }}
          severity: HIGH,CRITICAL
          ignore-unfixed: true               # only fail on problems that have a fix
          exit-code: "1"
      - name: Scan Dockerfile and Terraform for misconfigurations
        uses: aquasecurity/trivy-action@0.28.0
        with:
          scan-type: config
          scan-ref: .
          exit-code: "1"
      - name: Generate an SBOM (list of everything inside the image)
        uses: anchore/sbom-action@v0
        with:
          image: recipe-api:${{ github.sha }}
          format: spdx-json
# For third-party actions, pin a full commit SHA instead of a tag in real projects.
</code></pre>
