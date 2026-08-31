---
course: javascript
slug: javascript-fundamentals
title: JavaScript Fundamentals
description: Test your understanding of JavaScript variables, types, functions, and basic browser APIs.
difficulty: beginner
isTimed: true
timeLimitMinutes: 5
questions:
  - question: What is the result of typeof null in JavaScript?
    options:
      - 'null'
      - 'undefined'
      - 'object'
      - 'string'
    correctAnswer: 2
    explanation: JavaScript returns object for typeof null. This is a long-standing language quirk kept for compatibility.
    points: 5
  - question: Which keyword declares a block-scoped variable that can be reassigned?
    options:
      - var
      - let
      - const
      - static
    correctAnswer: 1
    explanation: let creates a block-scoped variable and allows its value to be reassigned.
    points: 5
  - question: Which method adds an item to the end of an array?
    options:
      - push()
      - pop()
      - shift()
      - slice()
    correctAnswer: 0
    explanation: push adds one or more items to the end of an array and returns the new length.
    points: 5
  - question: Which value is a primitive data type in JavaScript?
    options:
      - Array
      - Object
      - String
      - Function
    correctAnswer: 2
    explanation: Strings are primitive values. Arrays, objects, and functions are objects.
    points: 5
  - question: Which browser API selects the first element matching a CSS selector?
    options:
      - document.getElementsByClassName()
      - document.querySelector()
      - document.createElement()
      - document.appendChild()
    correctAnswer: 1
    explanation: querySelector returns the first element that matches the supplied CSS selector.
    points: 5
isPublished: true
---
