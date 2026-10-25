---
publishDate: 2026-10-31T14:05
title: Certification Paths and Where to Go Next
slug: certification-paths
metadescription: Choose an Azure certification that matches what you do, and know what each exam actually tests.
updateDate: 2026-09-07T14:05
author: ['bishal-biswas']
level: 1
tags: ['certification', 'career', 'learning']
course: azure
---

## The structure

```text
Fundamentals  AZ-900, AI-900, DP-900, SC-900. Concepts, no hands on requirement.
Associate     AZ-104, AZ-204, AZ-500, DP-300, AI-102, and more. Role based.
Expert        AZ-305, AZ-400. Design and process, and they assume experience.
Specialty     narrower topics like SAP on Azure or Azure Virtual Desktop.
```

Fundamentals are genuinely introductory. Associate exams expect you to have done the work. Expert exams expect judgement, not recall.

## Where to start

```text
New to cloud entirely
  AZ-900, then the associate matching your role

A developer
  AZ-204, then AZ-400 or AZ-305

An infrastructure or operations engineer
  AZ-104, then AZ-305 or AZ-500

Security focused
  AZ-500, and SC-900 first if identity concepts are new

Data focused
  DP-900, then DP-300 for databases or DP-203 for engineering

AI focused
  AI-900, then AI-102
```

**AZ-900 is skippable if you already work with cloud.** It is designed for people who need the vocabulary, including non technical roles, and an experienced engineer will find it slow.

## The main ones

**AZ-104, Azure Administrator.** Identity, governance, storage, compute, networking and monitoring. Broad rather than deep, and it is the foundation most other certifications build on.

The most useful associate certification for the widest audience, because everything in it is used daily.

**AZ-204, Azure Developer.** Compute options, storage, Cosmos DB, App Service, Functions, Key Vault, App Configuration, messaging, API Management, and the SDKs.

Genuinely developer focused, with real code in the questions. Expect Functions bindings, storage SDK usage and authentication flows.

**AZ-305, Azure Solutions Architect Expert.** Design rather than implementation: choosing services, designing for availability and cost, identity architecture, data platform choices.

Requires AZ-104. Questions are scenario based with several defensible answers, and the correct one is usually the simplest that meets every stated requirement.

**AZ-400, DevOps Engineer Expert.** Pipelines, source control strategy, infrastructure as code, release management, monitoring and feedback.

Requires AZ-104 or AZ-204. Covers both GitHub and Azure DevOps.

**AZ-500, Azure Security Engineer.** Identity, platform protection, security operations and data protection. Conditional Access, Defender for Cloud, Key Vault, network security and encryption.

**DP-300, Azure Database Administrator.** Deploying, securing, monitoring and optimising Azure SQL. More depth on performance tuning than most people expect.

**AI-102, Azure AI Engineer.** Azure OpenAI, AI Search, document intelligence, speech and vision, and building solutions with them.

## What the exams are like

```text
40 to 60 questions, 100 to 120 minutes
Multiple choice, drag and drop ordering, hot area, and case studies
Some exams include a lab, and labs are weighted heavily
Roughly 700 out of 1000 to pass, and the scale is not a percentage
Case studies cannot be revisited once you move past them
```

**Read the requirements carefully.** Scenario questions frequently include a constraint that eliminates the obvious answer: minimise cost, minimise administrative effort, or use only what already exists.

Those phrases are deliberate, and the answer usually turns on them.

## Preparing

```text
Microsoft Learn      free, official, and maps to the exam objectives
The skills outline   the definitive list of what is tested. Read it first.
Hands on practice    a free account, or a sandbox, is worth more than reading
Practice assessments free on Microsoft Learn, and good for calibration
Documentation        the exams follow it closely
```

**The skills outline is the most useful preparation document.** It lists every measured skill, and Microsoft updates it when the exam changes. Working through it and honestly marking what you cannot do produces a study plan in twenty minutes.

**Hands on matters more than study time.** An exam asks how to do things you should have done. Building something and breaking it teaches more than a video.

## Renewal

```text
Fundamentals  do not expire
Associate, Expert and Specialty  valid for a year, renewed free online
```

Renewal is a short unproctored assessment taken on Microsoft Learn, available six months before expiry, retakeable if failed. It is much less work than the original exam, and it covers what has changed in the year.

Missing the renewal window means retaking the full exam, so it is worth a calendar reminder.

## Are they worth it

Honestly, it depends what for.

```text
Genuinely useful for
  structured learning of a broad service surface
  getting past a recruitment filter
  a partner organisation needing them for competency levels
  a deadline that makes you actually study

Not a substitute for
  experience, which is what interviews assess
  judgement, which comes from having got things wrong
  depth in the parts of Azure you actually use
```

A certification proves you studied a syllabus. Experience proves you can build and run something. Most hiring processes weight the second far more heavily, and the first mainly helps you reach the conversation.

The most valuable part of certification is usually **the breadth**. Working through AZ-104 makes you aware of services you would not otherwise have met, and knowing something exists is what lets you reach for it later.

## Where to go next

```text
Build something end to end, with infrastructure as code and a pipeline
Read the Well-Architected and Cloud Adoption Framework documentation
Follow the Azure updates feed for what is changing
Learn one area deeply: networking, data, security or Kubernetes
Contribute to a Bicep or Terraform module used by others
Run something in production and be on call for it
```

That last one teaches more than any certification. Nothing else produces the same understanding of what actually matters at 3am.

## Quick recap

- Fundamentals are introductory, associates expect experience, and experts expect judgement.
- AZ-104 is the broadest foundation, and AZ-204 is genuinely developer focused.
- AZ-900 is skippable if you already work with cloud.
- Read the skills outline first, since it is the definitive list of what is tested.
- Scenario questions turn on constraints like minimising cost or administrative effort.
- Certifications renew free online each year, and missing the window means retaking the exam.
- Breadth is the real benefit, and running something in production teaches more than any exam.

<code id="code-content" class="language-bash">
# THE STRUCTURE:
#   FUNDAMENTALS  AZ-900, AI-900, DP-900, SC-900. Concepts, introductory.
#   ASSOCIATE     AZ-104, AZ-204, AZ-500, DP-300, AI-102. EXPECT YOU TO
#                 HAVE DONE THE WORK.
#   EXPERT        AZ-305, AZ-400. Judgement, not recall.
#   SPECIALTY     SAP on Azure, Azure Virtual Desktop.
# WHERE TO START:
#   new to cloud        AZ-900, then the associate for your role
#   developer           AZ-204, then AZ-400 or AZ-305
#   infrastructure ops  AZ-104, then AZ-305 or AZ-500
#   security            AZ-500 (SC-900 first if identity is new)
#   data                DP-900, then DP-300 or DP-203
# AZ-900 IS SKIPPABLE IF YOU ALREADY WORK WITH CLOUD. It is designed for
# people who need the vocabulary, including non technical roles.
# AZ-104 IS THE BROADEST FOUNDATION and the most useful for the widest
# audience, because everything in it is used daily.
# AZ-204 is GENUINELY developer focused, with real code: Functions bindings,
# storage SDK usage, authentication flows.
# AZ-305 questions are scenarios with several DEFENSIBLE answers, and the
# correct one is usually THE SIMPLEST THAT MEETS EVERY STATED REQUIREMENT.
# THE EXAMS:
#   40-60 questions, 100-120 minutes. Multiple choice, ordering, hot area,
#   CASE STUDIES THAT CANNOT BE REVISITED once you move past them.
#   Some include a LAB, weighted heavily. Roughly 700/1000 to pass, and the
#   scale is NOT a percentage.
# READ THE REQUIREMENTS CAREFULLY. Scenario questions include a constraint
# that ELIMINATES THE OBVIOUS ANSWER: "minimise cost", "minimise
# administrative effort", "use only existing resources". Those phrases are
# deliberate, and the answer usually turns on them.
# PREPARING. THE SKILLS OUTLINE IS THE MOST USEFUL DOCUMENT: it lists every
# measured skill, and honestly marking what you cannot do produces a study
# plan in twenty minutes.
# HANDS ON MATTERS MORE THAN STUDY TIME. An exam asks how to do things you
# SHOULD HAVE DONE. Building something and breaking it teaches more than a video.
# RENEWAL: fundamentals never expire. Everything else is valid a year and
# renewed FREE ONLINE, unproctored, available six months before expiry and
# retakeable. MISSING THE WINDOW MEANS RETAKING THE FULL EXAM, so set a
# calendar reminder.
# HONESTLY, ARE THEY WORTH IT?
#   useful for  structured learning of a broad surface, passing a
#               recruitment filter, partner competency, and a deadline that
#               makes you actually study
#   NOT a substitute for  experience, judgement, or depth in what you use
# A certification proves you studied a syllabus. Experience proves you can
# build and run something, and most hiring weights the second far more.
# THE REAL BENEFIT IS BREADTH: knowing a service EXISTS is what lets you
# reach for it later.
# WHERE TO GO NEXT: build something end to end with infrastructure as code
# and a pipeline; read the Well-Architected and Cloud Adoption Framework;
# follow Azure updates; learn ONE area deeply; and RUN SOMETHING IN
# PRODUCTION AND BE ON CALL FOR IT. Nothing else produces the same
# understanding of what actually matters at 3am.
</code></pre>
