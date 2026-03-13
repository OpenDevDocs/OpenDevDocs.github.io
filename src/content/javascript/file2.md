---
publishDate : 2025-05-24T08:30
title: 2 Article 
slug : variables-and-data-types
metadescription : Some Text
featuredImage : image2.png
updateDate : 2025-12-02T08:30
author : ['bishal-biswas']
level : 1
tags : []
---
## Understanding Promises

A <strong>Promise</strong> in JavaScript is an object representing the eventual completion (or failure) of an asynchronous operation and its resulting value.

<strong>Think of it like this:</strong> You order a burger at a restaurant. The waiter gives you a "buzzer." That buzzer is the <em>Promise</em>. It's not the burger, but it guarantees you'll get one eventually.

> **Albert Einstein once said:**
>
> "Life is like riding a bicycle. To keep your balance, you must keep moving."
>

### The Three States

A Promise is always in one of these three states:
   
- <strong>Pending:</strong> Initial state, neither fulfilled nor rejected.
- <strong>Fulfilled:</strong> The operation completed successfully.
- <strong>Rejected:</strong> The operation failed.

## Understanding Promises

A <strong>Promise</strong> in JavaScript is an object representing the eventual completion (or failure) of an asynchronous operation and its resulting value.

<strong>Think of it like this:</strong> You order a burger at a restaurant. The waiter gives you a "buzzer." That buzzer is the <em>Promise</em>. It's not the burger, but it guarantees you'll get one eventually.

> **Albert Einstein once said:**
>
> "Life is like riding a bicycle. To keep your balance, you must keep moving."
>

### The Three States

A Promise is always in one of these three states:
   
- <strong>Pending:</strong> Initial state, neither fulfilled nor rejected.
- <strong>Fulfilled:</strong> The operation completed successfully.
- <strong>Rejected:</strong> The operation failed.

<code id="code-content" class="language-javascript">
// Creating a new Promise
const fetchUserData = new Promise((resolve, reject) => {
    const success = true;
    setTimeout(() => {
        if (success) {
            resolve({ id: 1, name: "John Doe" });
        } else {
            reject("Error: Could not fetch data");
        }
    }, 2000);
});
// Consuming the Promise
console.log("Request started...");
fetchUserData
    .then((data) => {
        console.log("Success!", data);
    })
    .catch((error) => {
        console.error(error);
    })
    .finally(() => {
        console.log("Process finished.");
});
</code></pre>