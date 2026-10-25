---
publishDate: 2026-10-25T11:35
title: 'Deployment Strategies: Rolling, Blue-Green and Canary'
slug: deployment-strategies
metadescription: Compare deployment strategies, recreate, rolling, blue-green and canary releases, plus feature flags and ring deployments, and learn safe database migrations with expand and contract for zero-downtime releases.
updateDate: 2026-10-25T11:35
author: ['bishal-biswas']
level: 2
tags: ['devops', 'ci-cd', 'deployment', 'canary', 'blue-green']
course: devops
---

## Changing the engine while the plane is flying

In the [last lesson](/courses/devops/continuous-delivery-vs-deployment) your pipeline got an artifact all the way to production. But **how** do you swap the old version for the new one while users are in the middle of using it?

A **deployment strategy** is the answer. A good one gives you three things:

- **No downtime.** Users never see an error page because you are deploying.
- **A small blast radius.** If the new version is broken, as few users as possible are affected.
- **Fast rollback.** Getting back to the old version takes seconds, not an emergency rebuild.

Different strategies trade these off against cost and complexity. Let us go through the main ones, from simplest to most careful.

## Recreate

Stop every copy of the old version, then start the new one.

```text
v1 v1 v1   ->   (nothing running)   ->   v2 v2 v2
```

- **Good:** dead simple; only one version ever runs, so nothing has to cope with two at once.
- **Bad:** users get errors while nothing is running, and rollback means doing the whole thing again.

Fine for development environments, internal tools and scheduled maintenance windows. Avoid it for anything users rely on.

## Rolling deployment

Replace the old copies **a few at a time**. The [load balancer](/courses/devops/reverse-proxies-and-load-balancers) stops sending traffic to an instance, it is updated, it passes its health check, it rejoins, and the next one goes.

```text
step 0:  v1 v1 v1 v1
step 1:  v2 v1 v1 v1
step 2:  v2 v2 v1 v1
step 3:  v2 v2 v2 v1
step 4:  v2 v2 v2 v2
```

- **Good:** no downtime, no extra servers needed, and if health checks fail the rollout can stop part-way.
- **Bad:** for a while, **both versions serve users at the same time**, so they must be compatible (more on that below). Rolling back is another rolling deployment, so it is not instant.

This is the default in **Kubernetes**. A Deployment's settings say how many extra copies may be started and how many may be missing at any moment:

```yaml
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # at most 1 extra pod during the rollout (5 in total)
      maxUnavailable: 0    # never drop below 4 ready pods
```

## Blue-green deployment

Run **two complete, identical environments**, called **blue** and **green**. One serves all users; the other is idle.

```text
                 ┌──> BLUE   (v1)  live
Users ──> LB ────┤
                 └ ─> GREEN  (v2)  deployed and tested, waiting

        switch the load balancer

                 ┌ ─> BLUE   (v1)  idle, kept for rollback
Users ──> LB ────┤
                 └──> GREEN  (v2)  live
```

You deploy the new version to the idle environment, test it there as much as you like, then **switch** the load balancer (or DNS) so all traffic goes to it at once. Next release, the roles swap.

- **Good:** the switch is instant, and **rollback is instant too**: switch back to blue, which is still running the old version. You can test the real production setup before any user sees it.
- **Bad:** you need double the infrastructure, at least during the switch. Shared things, especially the **database**, are not duplicated, so both versions must work with the same data. Every user moves at once, so a bug the tests missed hits everyone.

## Canary release

Send a **small percentage** of real traffic to the new version, watch it closely, and increase the share step by step only while it stays healthy.

```text
 5% ──> v2       watch error rate, latency...  healthy?
25% ──> v2       watch...                      healthy?
50% ──> v2       watch...                      healthy?
100% ──> v2      done
         any step unhealthy?  ──>  0% to v2: automatic rollback
```

The name comes from the canaries coal miners took underground. The bird reacted to dangerous gas before the miners did, giving an early warning. Your canary version is the early warning: if it is sick, only a few users notice, and you pull it back.

- **Good:** the smallest blast radius of any strategy, and it tests the new version with **real** traffic and real data, which no test environment fully copies.
- **Bad:** more moving parts: weighted routing, good metrics, and clear rules for "healthy". Like rolling deploys, two versions run at once.

Canary analysis is usually **automated**: compare the canary's error rate and response time with the old version's, and roll back without waiting for a human if it is worse. Tools such as **Argo Rollouts** and **Flagger** do this in Kubernetes, and cloud load balancers support **weighted** routing. Even plain nginx can send a share of traffic by weight:

```nginx
upstream shop {
    server 10.0.2.11:3000 weight=19;   # v1.4: 95% of requests
    server 10.0.2.21:3000 weight=1;    # v1.5 canary: 5% of requests
}
```

## Feature flags, dark launches and rings

The strategies above control **which servers** run new code. **Feature flags** control **which users** see a new feature, independently of deployment:

- **Dark launch:** deploy the feature switched **off** for everyone. The code is live but invisible.
- **Gradual rollout:** turn it on for staff, then 1% of users, then 10%, then everyone.
- **Kill switch:** something wrong? Turn it off in seconds, with no deployment at all.

**Ring deployments** apply the same idea to whole releases, in widening circles: first the team itself, then the whole company, then early-adopter customers, then everyone. Microsoft popularised the term for Windows and Office updates.

> **Note:** A canary release and an **A/B test** look alike, since both send some users to something new. But a canary asks "is this version **safe**?" and should end quickly. An A/B test asks "which version do users **prefer**?" and runs long enough to measure behaviour. Do not mix the two up.

## Side by side

| Strategy | Downtime | Rollback speed | Blast radius | Extra cost | Two versions at once? |
|---|---|---|---|---|---|
| Recreate | Yes | Slow | Everyone | None | No |
| Rolling | No | Medium | Grows step by step | Little | Yes |
| Blue-green | No | Instant | Everyone, at the switch | Double environment | Briefly, then no |
| Canary | No | Fast (often automatic) | Smallest | Routing and monitoring | Yes |
| Feature flags | No | Instant | You choose | Flag tooling | Code paths, yes |

They also **combine** well. A common setup is a rolling or canary deployment of the code, with new features hidden behind flags until they are ready.

## The hard part: two versions, one database

Rolling and canary deployments run old and new code **at the same time**, against **the same database**. Blue-green does the same during the switch. So every database change must work with **both** versions.

Suppose you want to rename the column `name` to `full_name`. Renaming it in one step breaks the old code instantly, and you cannot roll back without breaking the new code. Instead, use **expand and contract** (also called **parallel change**), spread over several deployments:

| Step | Database | Code |
|---|---|---|
| 1. **Expand** | Add the new `full_name` column | Write to **both** columns; still read `name` |
| 2. Backfill | Copy existing data from `name` into `full_name` | (no change) |
| 3. Switch | (no change) | Read `full_name`; still write both |
| 4. **Contract** | Drop the old `name` column | Stop writing `name` |

At every step, the version before and the version after both work. Any single step can be rolled back safely. It takes more deployments, but each one is small and boring, which is exactly the point.

The same rule applies to APIs: **add** new fields and endpoints first, move clients over, and only **remove** the old ones once nothing uses them.

## Choosing a strategy

- **Starting out, with one or two servers?** Rolling deployments behind a load balancer, plus solid health checks.
- **Need instant rollback and can afford spare capacity?** Blue-green.
- **High traffic, where even a short outage for everyone is costly?** Canary with automated analysis.
- **Always:** feature flags for risky features, expand and contract for schema changes, and a [smoke test](/courses/devops/testing-in-the-pipeline) after every deployment.

## Watching a canary at work

The code panel for this lesson simulates a canary rollout. It sends 4,000 requests per step, shifts traffic to the new version in steps of 5%, 25%, 50% and 100%, and compares error rates at every step. If the new version is more than one percentage point worse, it rolls back automatically. The random numbers are seeded, so you get the same output every time.

A healthy release goes all the way:

```bash
node canary.mjs
```

```text
Canary rollout of v1.5

    5% traffic | v1.5: 0.48% errors | v1.4: 0.50% errors
   25% traffic | v1.5: 0.79% errors | v1.4: 0.70% errors
   50% traffic | v1.5: 0.34% errors | v1.4: 0.61% errors
  100% traffic | v1.5: 0.33% errors | v1.4: 0.61% errors (last step)

v1.5 is serving 100% of traffic. Rollout complete.
```

A release with a hidden bug that fails 6% of requests is stopped at the very first step:

```bash
node canary.mjs --bad
```

```text
Canary rollout of v1.5 (it has a hidden bug)

    5% traffic | v1.5: 5.80% errors | v1.4: 0.50% errors

ROLLBACK: v1.5 is clearly worse. All traffic is back on v1.4.
12 of the 207 requests sent to v1.5 failed.
A full release would have failed about 6% of ALL requests.
```

Notice two things. First, small error rates **wobble** from step to step even for a good release (0.79% at 25%), which is why the rule has a tolerance rather than "any increase means rollback". Second, the bad release hurt 12 requests instead of hundreds or thousands: that is the blast radius shrinking.

## Common misunderstandings

### "Blue-green means no risk"

The switch is instant in both directions, but at the moment of switching, **every** user moves to the new version. A bug the tests missed reaches everyone at once. Canary releases limit that.

### "Rollback always works"

Rolling back the **code** is easy. Rolling back **data** is not. If a release wrote data in a new format or dropped a column, the old version may not cope. That is why expand and contract exists.

### "Fancy strategies replace testing"

Canaries catch problems that only show up with real traffic. They are a last line of defence, not a replacement for the tests that should have caught most bugs earlier.

## Quick recap

- A deployment strategy aims for **no downtime**, a **small blast radius** and **fast rollback**.
- **Recreate:** simple, with downtime. **Rolling:** replace instances in batches, the Kubernetes default.
- **Blue-green:** two environments and an instant switch, both ways.
- **Canary:** a small share of real traffic first, increased while healthy, rolled back automatically if not.
- **Feature flags** and **rings** control who sees new features, separately from deployment.
- When two versions share a database, change it with **expand and contract**.

That completes the **CI/CD** section. Next, you will package apps so they run the same everywhere in [Containers vs Virtual Machines](/courses/devops/containers-vs-virtual-machines).

<code id="code-content" class="language-javascript">
// canary.mjs: a canary rollout with automatic rollback, simulated.
// Traffic moves to the new version step by step. At every step its error rate is
// compared with the old version's, and the rollout stops the moment it looks worse.
// Run it with: node canary.mjs          (a good release)
//          or: node canary.mjs --bad    (a release with a hidden bug)
const bad = process.argv.includes('--bad');
// A small seeded random generator, so every run prints the same numbers
let seed = 7;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed &gt;&gt;&gt; 15), 1 | seed);
  t = (t + Math.imul(t ^ (t &gt;&gt;&gt; 7), 61 | t)) ^ t;
  return ((t ^ (t &gt;&gt;&gt; 14)) &gt;&gt;&gt; 0) / 4294967296;
}
const OLD = { name: 'v1.4', errorRate: 0.005 };                  // 0.5%: normal background errors
const NEW = { name: 'v1.5', errorRate: bad ? 0.06 : 0.004 };     // the bug fails 6% of requests
const STEPS = [5, 25, 50, 100];          // percentage of traffic sent to the canary
const REQUESTS_PER_STEP = 4000;
const TOLERANCE = 1;                     // canary may be at most 1 percentage point worse
const percent = (t) =&gt; (t.requests ? (100 * t.errors) / t.requests : 0);
let baseline = OLD.errorRate * 100;
console.log(`Canary rollout of ${NEW.name}${bad ? ' (it has a hidden bug)' : ''}\n`);
for (const share of STEPS) {
  const seen = { old: { requests: 0, errors: 0 }, canary: { requests: 0, errors: 0 } };
  for (let i = 0; i &lt; REQUESTS_PER_STEP; i++) {
    const group = random() * 100 &lt; share ? 'canary' : 'old';
    const version = group === 'canary' ? NEW : OLD;
    seen[group].requests++;
    if (random() &lt; version.errorRate) seen[group].errors++;
  }
  if (seen.old.requests &gt; 0) baseline = percent(seen.old);
  const canaryRate = percent(seen.canary);
  console.log(`  ${String(share).padStart(3)}% traffic | ${NEW.name}: ${canaryRate.toFixed(2)}% errors` +
    ` | ${OLD.name}: ${baseline.toFixed(2)}% errors${seen.old.requests ? '' : ' (last step)'}`);
  if (canaryRate - baseline &gt; TOLERANCE) {
    console.log(`\nROLLBACK: ${NEW.name} is clearly worse. All traffic is back on ${OLD.name}.`);
    console.log(`${seen.canary.errors} of the ${seen.canary.requests} requests sent to ${NEW.name} failed.`);
    console.log(`A full release would have failed about ${canaryRate.toFixed(0)}% of ALL requests.`);
    process.exit(1);
  }
}
console.log(`\n${NEW.name} is serving 100% of traffic. Rollout complete.`);
</code></pre>
