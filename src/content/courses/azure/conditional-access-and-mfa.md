---
publishDate: 2026-10-05T07:05
title: Conditional Access and Multifactor Authentication
slug: conditional-access-and-mfa
metadescription: Control who can sign in and under what conditions with Conditional Access policies, and roll out multifactor authentication without locking yourself out.
updateDate: 2026-09-07T07:05
author: ['bishal-biswas']
level: 2
tags: ['identity', 'security', 'conditional access']
course: azure
---

## What a policy is

A Conditional Access policy is an if then rule evaluated at sign in.

```text
IF    these users
AND   accessing these applications
AND   under these conditions
THEN  grant access requiring these controls, or block
```

It runs after the password is verified, which is the key point. A stolen password gets past authentication and then meets the policy.

Conditional Access needs Entra ID P1. Without it there is Security Defaults, which is a single on or off switch that enforces MFA for everyone. Security Defaults is much better than nothing.

## Assignments: who and what

```text
Users            include a group, exclude a break glass account
Target resources all cloud apps, or specific ones
Conditions       location, device platform, client app, sign in risk
```

**Always exclude a break glass account.** A policy that requires a compliant device, applied to all users, locks out every administrator the moment something goes wrong with device compliance. This happens regularly.

```text
Break glass account:
  cloud only, not synced
  a long random password in a physical safe
  excluded from every Conditional Access policy
  monitored, so any sign in raises an alert
  two of them, in case one is broken
```

## Grant controls

```text
Block access
Require multifactor authentication
Require device to be marked compliant
Require Microsoft Entra hybrid joined device
Require approved client app
Require app protection policy
Require password change
```

Multiple controls combine with **require all** or **require one**, and that choice matters. Require all with both compliant device and hybrid joined blocks anyone whose device is one but not the other.

## Session controls

```text
Sign in frequency        re-authenticate every N hours or days
Persistent browser       whether "stay signed in" is allowed
App enforced restrictions  limited access in browser only
Continuous access evaluation  revoke a token mid session on a risk event
```

Continuous access evaluation is worth knowing about. Normally an access token is valid for its lifetime, roughly an hour, even if the account is disabled. With CAE, supporting services check for critical events and can reject a token immediately.

Disabling a compromised account without CAE leaves a window. With it, the window closes.

## Policies most tenants need

**Require MFA for administrators.** Non negotiable. Directory role holders, always.

**Require MFA for all users.** Start in report only, look at the impact, then enforce.

**Block legacy authentication.** This is the highest value policy on this list.

```text
Legacy protocols cannot do MFA. POP, IMAP, SMTP AUTH, older Office clients.
An attacker with a valid password uses one of these to bypass MFA entirely.
```

Blocking legacy authentication closes the most common MFA bypass. Check sign in logs first for anything still using it, since a scanner or a device may break.

**Require compliant devices for sensitive apps.** Needs Intune.

**Block sign in from unexpected countries.** Useful, and easy to over apply. A traveller with no exception is a support ticket.

**Require MFA for risky sign ins.** Needs P2 and Identity Protection, which scores each sign in for anomalies.

## Report only mode

```text
Off          not evaluated
Report only  evaluated and logged, not enforced
On           enforced
```

Every new policy goes into report only first. The logs then show exactly who would have been blocked, and the answer is often a service account nobody remembered.

```bash
az rest --method get \
  --url "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies" \
  --query "value[].{Name:displayName, State:state}" --output table
```

Run for a week, read the impact, then enforce.

## Authentication methods

```text
Passkey (FIDO2)          phishing resistant, the strongest option
Certificate based        phishing resistant
Microsoft Authenticator  number matching, good
Passwordless phone sign in  good
OATH tokens              fine
SMS and voice            weakest, vulnerable to SIM swapping
```

SMS is better than no MFA and worse than everything else. Where it is the fallback, an attacker will target it.

Number matching in Authenticator exists because of MFA fatigue attacks, where an attacker spams push notifications until someone taps approve. Number matching requires typing a number shown on screen, so tapping approve blindly no longer works. It is on by default now.

## Passkeys

The direction of travel is away from passwords entirely. A passkey is bound to the device, cannot be phished, and cannot be reused on a lookalike site.

```text
Register a passkey, then a policy requiring phishing resistant MFA
for administrators, and the highest value accounts are genuinely protected.
```

Start with administrators. They are the accounts worth attacking.

## Testing safely

```text
1. Create the policy in report only
2. Scope it to a pilot group, not everyone
3. Read the sign in logs, filtered to the policy
4. Widen the scope, still report only
5. Enforce
6. Keep the break glass exclusion, always
```

The sign in logs are where you check what happened, and they show which policies applied and which controls were satisfied.

```bash
az rest --method get \
  --url "https://graph.microsoft.com/v1.0/auditLogs/signIns?\$top=20" \
  --query "value[].{User:userPrincipalName, App:appDisplayName, Status:status.errorCode}" \
  --output table
```

## Common mistakes

**No break glass exclusion.** Eventually locks everyone out.

**Enforcing without report only.** Discovers the impact in production, at the worst moment.

**Blocking legacy authentication without checking.** Something is probably still using it. A multifunction printer that scans to email is the classic.

**Requiring MFA for service principals.** They cannot do it. Workload identities need their own policy type, which is a separate licence.

**Trusting location as a control.** An IP address is not identity. Location narrows risk, it does not establish who someone is.

## Quick recap

- A Conditional Access policy runs after the password check, so it catches stolen passwords.
- Always exclude a break glass account, and have two of them.
- Blocking legacy authentication is the highest value policy, since those protocols bypass MFA.
- Put every new policy in report only first, then read the logs.
- Number matching exists to defeat MFA fatigue attacks, and is on by default.
- Passkeys are phishing resistant, and administrators are where to start.
- Location is a risk signal, not an identity control.

<code id="code-content" class="language-bash">
# A policy is an IF THEN rule evaluated AT SIGN IN, AFTER the password is
# verified. That is the point: a stolen password gets past authentication
# and then meets the policy. Needs Entra ID P1. Without it, Security
# Defaults is a single switch enforcing MFA for everyone, and beats nothing.
#   IF   these users AND these apps AND these conditions
#   THEN require these controls, or block
# ALWAYS EXCLUDE A BREAK GLASS ACCOUNT. A "require compliant device" policy
# applied to all users locks out every administrator the moment device
# compliance breaks. This happens regularly.
#   cloud only, not synced | long random password in a safe
#   excluded from EVERY policy | alert on any sign in | have TWO
# THE HIGHEST VALUE POLICY: block legacy authentication. POP, IMAP,
# SMTP AUTH and older Office clients CANNOT do MFA, so an attacker with a
# valid password uses one to bypass it entirely. Check logs first: the
# printer that scans to email is the classic breakage.
# EVERY NEW POLICY GOES TO REPORT ONLY FIRST.
#   Off | Report only (evaluated and logged, NOT enforced) | On
# Run a week, read who WOULD have been blocked (usually a forgotten service
# account), then enforce.
az rest --method get \
  --url "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies" \
  --query "value[].{Name:displayName, State:state}" -o table
# Check what actually happened in the sign in logs:
az rest --method get \
  --url "https://graph.microsoft.com/v1.0/auditLogs/signIns?\$top=20" \
  --query "value[].{User:userPrincipalName, App:appDisplayName, Code:status.errorCode}" -o table
# METHODS, STRONGEST TO WEAKEST:
#   passkey (FIDO2), certificate  phishing resistant
#   Authenticator with number matching, passwordless phone sign in
#   OATH tokens
#   SMS and voice                 vulnerable to SIM swapping
# Number matching exists because of MFA FATIGUE attacks: spam push
# notifications until someone taps approve. It is on by default now.
# SESSION CONTROLS: sign in frequency, persistent browser, and CONTINUOUS
# ACCESS EVALUATION, which revokes a token MID SESSION on a risk event.
# Without CAE, disabling a compromised account leaves an hour long window.
# MISTAKES: no break glass exclusion; enforcing without report only;
# requiring MFA for service principals (they cannot do it); trusting
# location as identity. An IP address narrows risk, it does not prove who.
</code></pre>
