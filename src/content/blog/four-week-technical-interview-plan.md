---
title: A Four-Week Plan for Your First Technical Interview
slug: four-week-technical-interview-plan
metadescription: A week-by-week plan to prepare for a junior developer interview, from refreshing fundamentals to explaining your own projects out loud.
featuredImage: ""
publishDate: 2026-06-09T09:00:00.000Z
updateDate: 2026-06-09T09:00:00.000Z
author:
  - bishal-biswas
category: Career
tags:
  - interviews
  - career
  - learning
isDraft: false
---

You have an interview booked in a month, or you plan to start applying soon. You know how to write code, but you are not sure how to show that in an hour with a stranger watching. This plan breaks the month into four focused weeks. It assumes about an hour a day on weekdays and a longer session at the weekend, and it works for most junior and early mid-level roles.

Our [Interview Prep](/interview-prep) page collects the question banks and guidance on this site in one place. This post is about how to use your time.

## Before you start: read the job description properly

Print or copy the job description and highlight every technology and skill it mentions. Then sort them into three groups:

- **Core**: the main language and framework, for example C# and ASP.NET Core, or JavaScript and React.
- **Supporting**: things you will use daily but are unlikely to be grilled on, such as Git, SQL basics or Docker.
- **Nice to have**: anything listed under "bonus" or "preferred".

Most of your time goes on the core group. Supporting skills need to be solid enough to talk about honestly. Do not spend the month chasing the nice-to-haves.

## Week 1: Fundamentals of your main language

Interviewers almost always start with the language itself, because it shows quickly whether you understand what your code does or only that it works.

Go back over the basics and make sure you can explain them without notes:

- Types and how values are stored, for example value types versus reference types in C#, or primitives versus objects in JavaScript.
- Scope and closures.
- How errors are thrown and handled.
- Collections and when to use each one.
- Asynchronous code: what `async` and `await` actually do.

For each topic, write a three-sentence explanation in your own words, then a short code example that proves it. If you cannot write the example, you do not understand the topic yet; go back to the relevant course lesson.

At the end of the week, work through the fresher-level questions in the question bank for your language, such as the [C# interview questions](/courses/c-sharp/interview-questions). Answer each one out loud before you reveal the written answer.

## Week 2: Your framework and how a request flows

Week two moves from the language to the framework you will use on the job. The most useful single thing you can do is trace one request from start to finish and be able to describe every step:

1. The request arrives at the server.
2. Middleware runs: logging, authentication, parsing the body.
3. Routing picks a handler or controller action.
4. The handler validates input and calls your business logic.
5. Data is read from or written to a database.
6. A response is built, serialised and sent back.
7. If anything throws, an error handler turns it into a proper response.

If you can draw this on a whiteboard for your framework and say what you would put at each step, you can answer a large share of the framework questions you will be asked.

Also review how configuration and secrets are handled, how dependency injection works if your framework uses it, and how you would write a test for one endpoint.

## Week 3: Problem solving and data structures

Many companies include a coding exercise. For junior roles it is usually a practical problem, not an obscure algorithm puzzle, but you still need to be comfortable with:

- Arrays, strings and hash maps (dictionaries or objects)
- Sorting and searching
- Simple recursion
- Big-O notation at a basic level: why a nested loop over the same list is slower than a single pass with a hash map

Our [Data Structures and Algorithms course](/courses/dsa) covers these in order.

Practise in the way interviews actually work. Set a timer for 30 minutes. Read the problem, then **say out loud** what you think it is asking and one or two example inputs and outputs before you write any code. Write a simple working solution first, even if it is slow. Then improve it. Interviewers care far more about how you reason than whether you find the optimal answer.

## Week 4: Your own projects and the human side

The last week is about the parts of an interview people forget to practise.

**Your projects.** You will almost certainly be asked, "Tell me about something you built." Pick one or two projects and prepare to explain:

- What problem it solves and who it is for
- The main technical decisions and why you made them
- Something that went wrong and how you fixed it
- What you would do differently now

Open the code again and make sure you remember how it works. Being caught out by questions about your own project is a bad look and an easy one to avoid.

**Behavioural questions.** Prepare short stories for common prompts: a time you disagreed with someone, a time you made a mistake, a time you learned something quickly. A simple structure works well: the situation, what you did, and what happened as a result.

**Questions for them.** Prepare three or four questions about the team, how work is planned, how code is reviewed and what the first few months in the role look like. Asking good questions signals real interest.

**A mock interview.** Ask a friend, classmate or mentor to interview you for 45 minutes using questions from the question bank. If nobody is available, record yourself answering questions on video. It is uncomfortable to watch, and very effective.

## The day before and the day itself

- Check the time, the time zone, the video link and your microphone the day before.
- Have water, a notepad and the job description to hand.
- When you get a question you do not know, say so, then reason about it out loud: "I have not used that directly, but I would expect it to work like this, because..." That is a much better answer than guessing confidently or going silent.
- At the end, thank them and ask about the next steps and timeline.

## After the interview

Write down every question you were asked as soon as you can, while you still remember them. Mark the ones you struggled with and look them up that evening. Whether or not you get the offer, that list makes your next interview easier, and over a few interviews it becomes the most targeted revision guide you could ask for.
