---
publishDate: 2026-10-25T09:01
title: 'How the Web Works: HTTP Requests and Responses'
slug: how-the-web-works-http
metadescription: Learn how browsers and servers talk using HTTP, what requests, responses, methods, status codes and headers are, and how to see them yourself with curl.
updateDate: 2026-10-25T09:01
author: ['bishal-biswas']
level: 1
tags: ['express', 'http', 'web-basics', 'beginners']
course: expressjs
---

## What you will learn

- What happens, step by step, when you type a web address and press Enter
- The parts of a **URL**, including the **host**, **port**, **path** and **query string**
- What an **HTTP request** and an **HTTP response** look like on the inside
- The most common **HTTP methods**, **status codes** and **headers**
- How to see real requests yourself with your browser's DevTools and the `curl` command

Express is a tool for answering HTTP requests. Before you write a single line of Express, it really helps to know what a request actually is. This lesson has no Express code at all, just the ideas you will use in every lesson after it.

## The big picture: clients and servers

The web is a conversation between two kinds of programs:

- A **client** asks for something. Your web browser is a client. So is a mobile app, or a command-line tool.
- A **server** listens for questions and sends back answers. The Express apps you will build are servers.

The client always speaks first. The server never sends anything until it is asked. Every "question" is called a **request**, and every "answer" is called a **response**.

```text
  Client (browser)                      Server (your Express app)
        |                                          |
        |  ---- request: "GET /about please" ---->  |
        |                                          |  works out the answer
        |  <--- response: "200 OK, here's HTML" --  |
        |                                          |
```

The rules for how these messages are written are called **HTTP**, short for **HyperText Transfer Protocol**. A **protocol** is just an agreed set of rules, like the rules for writing a postal address so the mail carrier understands it.

> **Note:** **HTTPS** is HTTP with encryption added. The messages look exactly the same; they are just scrambled while travelling so nobody in the middle can read them. On your own computer during development you will use plain `http://`.

## Reading a URL

A **URL** (Uniform Resource Locator) is the address of something on the web. Let's take one apart:

```text
https://shop.example.com:443/products/42?color=red&size=m
\___/   \______________/ \_/\__________/ \_______________/
  |            |          |       |               |
protocol      host       port    path        query string
```

| Part | Example | What it means |
| --- | --- | --- |
| **Protocol** (scheme) | `https` | Which set of rules to use: `http` or `https` |
| **Host** | `shop.example.com` | Which computer to talk to |
| **Port** | `443` | Which "door" on that computer to knock on |
| **Path** | `/products/42` | Which thing you want from the server |
| **Query string** | `?color=red&size=m` | Extra options, as `key=value` pairs |

### Hosts and DNS

Computers on a network find each other by **IP address**, a number like `93.184.215.14`. Names like `shop.example.com` are easier for humans. A system called **DNS** (Domain Name System) works like a phone book: it turns the name into the IP address.

### Ports: doors on a building

One computer can run many server programs at once. A **port** is a number from 0 to 65535 that says which program should get the message. If the host is an apartment building, the port is the apartment number.

Some ports have defaults, so browsers hide them:

| Port | Used for |
| --- | --- |
| `80` | Plain `http://` websites (the default, so you rarely type it) |
| `443` | Secure `https://` websites (also a default) |
| `3000`, `5000`, `8080` | Common choices for development servers on your own computer |

### localhost: your own computer

During this course you will visit addresses like `http://localhost:3000`. **localhost** is a special name that always means "this computer I am sitting at". Its IP address is `127.0.0.1` (or `::1` in the newer IPv6 format). Nothing leaves your machine; the browser and your Express server are simply talking to each other on the same computer.

So `http://localhost:3000/about` means: "Using HTTP, talk to the program on *my own computer* behind door number *3000*, and ask it for `/about`."

## What happens when you press Enter

Here is the whole journey for `https://example.com/about`, in plain steps:

1. The browser reads the URL and finds the host `example.com`.
2. It asks DNS for the IP address of `example.com`.
3. It opens a connection to that IP address on port `443`.
4. It sends an HTTP **request** asking for the path `/about`.
5. The server program receives the request, runs some code, and builds a **response**.
6. The response travels back. The browser reads it and shows you the page.
7. If the page needs more files (images, CSS, JavaScript), the browser sends one more request for **each** of them.

That last step surprises many beginners. One web page is often dozens of separate requests.

## Inside an HTTP request

An HTTP request is just text with a fixed layout. Here is a real one:

```http
GET /products/42?color=red HTTP/1.1
Host: shop.example.com
User-Agent: Mozilla/5.0
Accept: text/html
```

It has up to four parts:

1. **The request line**: the method (`GET`), the path plus query (`/products/42?color=red`) and the HTTP version.
2. **Headers**: extra information as `Name: value` lines. `Host` says which website you want. `User-Agent` says which program is asking. `Accept` says what kind of answer the client prefers.
3. **A blank line** that marks the end of the headers.
4. **A body** (optional): data the client is sending, such as a filled-in form.

Here is a request that *does* have a body. It is sending JSON to create a new user:

```http
POST /users HTTP/1.1
Host: api.example.com
Content-Type: application/json
Content-Length: 39

{"name":"Asha","email":"a@example.com"}
```

The `Content-Type` header tells the server what format the body is in. In later lessons Express will read this body for you.

### HTTP methods: the verb of the request

The **method** says what the client wants to *do*. Think of the path as the noun and the method as the verb.

| Method | Meaning | Real-life example |
| --- | --- | --- |
| `GET` | Read something | Open a product page |
| `POST` | Create something new | Submit a sign-up form |
| `PUT` | Replace something completely | Save a whole edited profile |
| `PATCH` | Change part of something | Update only your email address |
| `DELETE` | Remove something | Delete a comment |
| `HEAD` | Like `GET`, but headers only | Check if a file exists |
| `OPTIONS` | Ask what is allowed | Browsers use it for CORS checks |

When you type a URL into the browser's address bar, the browser always sends `GET`. To send other methods you use a form, JavaScript code, or a tool like `curl`.

## Inside an HTTP response

The server's answer has the same shape: a first line, headers, a blank line, and a body.

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 45
Date: Sun, 25 Oct 2026 09:00:00 GMT

<html><body><h1>Product 42</h1></body></html>
```

1. **The status line**: HTTP version, a **status code** (`200`) and a short **reason phrase** (`OK`).
2. **Headers**: `Content-Type` tells the browser how to read the body (HTML, JSON, an image...).
3. **A blank line**.
4. **The body**: the actual content.

### Status codes: how did it go?

A **status code** is a three-digit number that tells the client, at a glance, whether things worked. The first digit gives the family:

| Range | Family | Common examples |
| --- | --- | --- |
| `1xx` | Information | Rarely seen directly |
| `2xx` | Success | `200 OK`, `201 Created`, `204 No Content` |
| `3xx` | Redirect: look somewhere else | `301 Moved Permanently`, `302 Found`, `304 Not Modified` |
| `4xx` | Client error: the request was wrong | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found` |
| `5xx` | Server error: the server broke | `500 Internal Server Error`, `503 Service Unavailable` |

> **Tip:** A quick way to remember: 4xx means "you messed up", 5xx means "we messed up". Choosing the right code matters, and you will practise it in [Status Codes and Response Headers](/courses/expressjs/status-codes-and-headers).

### Common headers

**Headers** are labels on the envelope. They carry information *about* the message. A few you will meet often:

| Header | Sent by | Purpose |
| --- | --- | --- |
| `Host` | Client | Which website the request is for |
| `Content-Type` | Both | Format of the body, e.g. `application/json` or `text/html` |
| `Content-Length` | Both | Size of the body in bytes |
| `Accept` | Client | Formats the client would like back |
| `Authorization` | Client | Login token or credentials |
| `Cookie` / `Set-Cookie` | Client / Server | Small pieces of data the browser remembers |
| `Location` | Server | Where to go next, used with redirects |

## HTTP is stateless

**Stateless** means each request stands alone. The server does not automatically remember your previous request, just like a vending machine does not remember you from yesterday.

So how does a website keep you logged in? The browser sends a little piece of identifying data, such as a **cookie** or a **token**, with *every* request. You will learn these tricks later in the course, in [Cookies with cookie-parser](/courses/expressjs/cookies-and-cookie-parser) and [JWT Authentication](/courses/expressjs/jwt-authentication).

## See it yourself: browser DevTools

Every modern browser can show you the requests it sends.

1. Open any website in Chrome, Edge or Firefox.
2. Press `F12` (or right-click the page and choose **Inspect**).
3. Click the **Network** tab.
4. Reload the page with `F5`.

You will see a list of every request. Click one and look at the **Headers** section. You can find the method, the status code, the request headers and the response headers, exactly as described above.

## See it yourself: curl

**curl** is a small command-line program that sends HTTP requests and prints the response. It is the tool you will use most in this course to test your Express servers. It comes pre-installed on macOS, most Linux systems and Windows 10 and 11.

A **terminal** (also called a command line or shell) is a window where you type commands instead of clicking. On Windows, open **PowerShell** or **Command Prompt** from the Start menu. On macOS, open **Terminal**. The next lesson covers terminals in more detail.

Type this and press Enter:

```bash
curl -i https://example.com
```

The `-i` flag means "include the response headers in the output". You will see something like this (shortened):

```text
HTTP/2 200
content-type: text/html
content-length: 1256
...

<!doctype html>
<html>
<head>
    <title>Example Domain</title>
...
```

There it is: the status line, the headers, a blank line, and the HTML body.

To see the request **you** sent as well, use `-v` (verbose). Lines starting with `>` are the request; lines starting with `<` are the response:

```bash
curl -v https://example.com
```

```text
> GET / HTTP/2
> Host: example.com
> User-Agent: curl/8.9.0
> Accept: */*
>
< HTTP/2 200
< content-type: text/html
...
```

> **Note:** You may see `HTTP/2` instead of `HTTP/1.1`. HTTP/2 is a faster, newer way of sending the same messages. The methods, status codes and headers mean exactly the same thing, so you can ignore the difference for now.

> **Warning:** In **Windows PowerShell**, `curl` is a shortcut for a different command (`Invoke-WebRequest`) that prints output in another format. Type `curl.exe` instead of `curl` to use the real curl. Command Prompt and Git Bash do not have this problem.

## Common beginner questions

**Is a "web page" the same as a "request"?**
No. One page usually needs many requests: one for the HTML, then one each for the CSS, JavaScript files and images.

**Where does Express fit in?**
Express runs on the server side. It receives the request, lets you decide what to do based on the method and path, and helps you build the response.

**Do APIs use HTTP too?**
Yes. An **API** (Application Programming Interface) is a server that answers with data, usually JSON, instead of web pages. The requests and responses look exactly the same; only the body format differs.

## Key takeaways

- A **client** sends a **request**; a **server** sends back a **response**. The client always speaks first.
- A URL has a **protocol**, **host**, **port**, **path** and optional **query string**. `localhost` means your own computer.
- A request has a **method**, a **path**, **headers** and an optional **body**.
- A response has a **status code**, **headers** and a **body**. 2xx is success, 4xx is a client error, 5xx is a server error.
- HTTP is **stateless**: every request must carry everything the server needs to know.
- You can inspect real traffic with the browser's **Network** tab and with `curl -i` or `curl -v`.

## Practice

1. Take the URL `http://localhost:3000/search?q=shoes&page=2` and name each part: protocol, host, port, path and query string.
2. Open the Network tab on your favourite website, reload, and count how many requests one page makes. Find one response with a `200` status and one with a different status.
3. Run `curl -i https://example.com` and find the `Content-Type` header in the output.
4. For each action, pick the best HTTP method: reading a blog post, posting a comment, deleting a photo, changing only your username.

## What's next

To build your own server you need Node.js and npm installed and working. Continue with [Node.js and npm Prerequisites](/courses/expressjs/nodejs-and-npm-prerequisites).
