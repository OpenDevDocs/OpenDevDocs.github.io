---
publishDate: 2026-10-27T09:01
title: 'Calling Web APIs with requests'
slug: calling-web-apis
metadescription: 'Fetch live JSON data from the internet with the requests library: GET and POST, query parameters, status codes, timeouts and graceful error handling.'
updateDate: 2026-10-27T09:01
author: ['bishal-biswas']
level: 2
tags: ['python', 'requests', 'api', 'json']
course: python
---

## What is a web API?

When you open a website, your browser asks a server for a page and the server sends back HTML for people to read. A **web API** (Application Programming Interface) works the same way, but the server answers with **data** for programs to read, usually in [JSON](/courses/python/json-and-csv) format.

Think of a restaurant. You (the program) do not walk into the kitchen. You give your order to a waiter (the API), and the waiter brings back exactly what you asked for. Weather apps, maps, currency converters and chat bots all get their data this way.

In this lesson you will use **requests**, the most popular Python library for talking to web APIs. You will call **JSONPlaceholder** (`https://jsonplaceholder.typicode.com`), a free practice API with fake users, posts and todos that needs no account or key. You will also peek at the real GitHub API.

## Installing requests

`requests` is not part of the standard library, so install it with pip inside a [virtual environment](/courses/python/virtual-environments), as you learned in [Installing Packages with pip](/courses/python/pip-and-packages).

On Windows:

```powershell
python -m venv .venv
.venv\Scripts\activate
python -m pip install requests
```

On macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install requests
```

> **Note:** Python also has a built-in module, `urllib.request`, that can fetch web pages. It works, but `requests` is much friendlier, which is why almost everyone uses it. Its docs live at [pypi.org/project/requests](https://pypi.org/project/requests/).

## A few words you need

| Word | Meaning |
| --- | --- |
| **URL** or **endpoint** | The address you send the request to, like `/todos/1` |
| **GET** | A request that **reads** data |
| **POST** | A request that **sends** new data |
| **Status code** | A number the server sends back to say how it went |
| **Headers** | Extra labels on a request or response, like the content type |
| **Query parameters** | Filters added after `?` in the URL, like `?userId=1` |

Common status codes:

| Code | Meaning |
| --- | --- |
| `200` | OK, here is your data |
| `201` | Created (after a successful POST) |
| `400` | Bad request: you sent something wrong |
| `401` / `403` | Not logged in / not allowed |
| `404` | Not found |
| `429` | Too many requests: slow down |
| `500` | The server itself had a problem |

Codes starting with 4 mean **you** made a mistake; codes starting with 5 mean the **server** did.

## Your first GET request

```python
import requests

response = requests.get("https://jsonplaceholder.typicode.com/todos/1", timeout=10)
print(response.status_code)
print(response.headers["Content-Type"])
print(response.text)
data = response.json()
print(data["title"], data["completed"])
```

Output:

```text
200
application/json; charset=utf-8
{
  "userId": 1,
  "id": 1,
  "title": "delectus aut autem",
  "completed": false
}
delectus aut autem False
```

Step by step:

- `requests.get()` sends the request and gives back a **response** object.
- `response.text` is the raw reply as a string.
- `response.json()` turns the JSON into normal Python [dictionaries](/courses/python/dictionaries) and [lists](/courses/python/lists). Notice JSON's `false` became Python's `False`.
- `timeout=10` means "give up after 10 seconds". Always set one, or your program could wait forever.

## Query parameters

Many APIs let you filter results with query parameters. Instead of building the `?` part by hand, pass a dictionary to `params`. `requests` builds the URL safely for you.

```python
import requests

response = requests.get(
    "https://jsonplaceholder.typicode.com/posts",
    params={"userId": 1},
    timeout=10,
)
print(response.url)
posts = response.json()
print(len(posts), "posts")
for post in posts[:3]:
    print(post["id"], post["title"][:40])
```

Output:

```text
https://jsonplaceholder.typicode.com/posts?userId=1
10 posts
1 sunt aut facere repellat provident occae
2 qui est esse
3 ea molestias quasi exercitationem repell
```

(The text is fake Latin filler, which is normal for a practice API.)

## Sending data with POST

To create something, send a POST request. The `json=` argument converts your dictionary to JSON and sets the right header automatically.

```python
import requests

new_post = {"title": "Learning Python", "body": "APIs are fun", "userId": 1}
response = requests.post("https://jsonplaceholder.typicode.com/posts", json=new_post, timeout=10)
print(response.status_code)
print(response.json())
```

Output:

```text
201
{'title': 'Learning Python', 'body': 'APIs are fun', 'userId': 1, 'id': 101}
```

Status `201` means "created". JSONPlaceholder only pretends to save it, so it is safe to experiment.

## Headers and a real API

Some APIs want special headers. GitHub's public API, for example, asks every caller to send a `User-Agent` header that names the app. You can read public data without a key:

```python
import requests

response = requests.get(
    "https://api.github.com/repos/python/cpython",
    headers={"Accept": "application/vnd.github+json", "User-Agent": "learning-python"},
    timeout=10,
)
repo = response.json()
print(repo["full_name"])
print(repo["description"])
print(repo["language"], repo["license"]["spdx_id"])
print("Rate limit left:", response.headers.get("X-RateLimit-Remaining"))
```

Output (the rate limit number will differ):

```text
python/cpython
The Python programming language
Python NOASSERTION
Rate limit left: 58
```

Without a key, GitHub allows about 60 requests per hour from your network. The **rate limit** header tells you how many you have left.

> **Warning:** Many APIs need a secret **API key**. Never write keys directly in your code or commit them to Git. Keep them in an environment variable and read them with `os.environ["MY_API_KEY"]`.

## When things go wrong

Networks are unreliable. Your Wi-Fi drops, the server is slow, or the thing you asked for does not exist. A good program expects this.

First, a request that reaches the server but gets a 404 does **not** raise an error by itself. Check `response.ok`, or call `raise_for_status()` to turn bad status codes into an exception:

```python
import requests

response = requests.get("https://jsonplaceholder.typicode.com/todos/99999", timeout=10)
print(response.status_code, response.ok)
try:
    response.raise_for_status()
except requests.HTTPError as e:
    print("HTTP error:", e)
```

Output:

```text
404 False
HTTP error: 404 Client Error: Not Found for url: https://jsonplaceholder.typicode.com/todos/99999
```

Second, a timeout raises `requests.Timeout`. Here a silly tiny timeout forces one:

```python
import requests

try:
    requests.get("https://jsonplaceholder.typicode.com/users", timeout=0.001)
except requests.Timeout as e:
    print("Timed out:", type(e).__name__)
```

Output:

```text
Timed out: ConnectTimeout
```

Now put it all together in one safe helper function, using what you learned in [Handling Errors with try and except](/courses/python/exceptions):

```python
import requests


def fetch_json(url, **params):
    try:
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.Timeout:
        print("The server took too long to answer.")
    except requests.ConnectionError:
        print("Could not connect. Check your internet connection.")
    except requests.HTTPError as e:
        print("The server said no:", e.response.status_code)
    except ValueError:
        print("The answer was not valid JSON.")
    return None


print(fetch_json("https://jsonplaceholder.typicode.com/users/1")["name"])
print(fetch_json("https://jsonplaceholder.typicode.com/users/0"))
print(fetch_json("https://no-such-host.invalid/data"))
```

Output:

```text
Leanne Graham
The server said no: 404
None
Could not connect. Check your internet connection.
None
```

The program never crashed. It printed a friendly message and returned `None`, so the caller can decide what to do next. All of these errors inherit from `requests.RequestException`, so `except requests.RequestException:` catches any of them at once.

## Common mistakes

**1. Forgetting to install requests (or using the wrong Python).**

```text
ModuleNotFoundError: No module named 'requests'
```

Fix: activate your virtual environment, then `python -m pip install requests`.

**2. Treating the response like a dictionary.** `response["title"]` fails:

```text
TypeError: 'Response' object is not subscriptable
```

Fix: decode it first: `response.json()["title"]`.

**3. Calling `.json()` on something that is not JSON.** Asking the JSONPlaceholder home page (an HTML page) for JSON fails:

```text
requests.exceptions.JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

Fix: check the URL and `response.headers["Content-Type"]`.

**4. Wrong key names.** `data["Title"]` raises `KeyError: 'Title'` because keys are case sensitive. Print the data once to see its real shape, or use `data.get("title")`.

**5. No timeout.** Without `timeout=`, a stuck server can freeze your program. Always add one.

## Quick recap

- A web API returns data (usually JSON) instead of web pages.
- `requests.get(url, params=..., timeout=...)` reads data; `requests.post(url, json=...)` sends it.
- `response.status_code` says how it went; `response.json()` gives you Python objects.
- Call `raise_for_status()` so 4xx and 5xx codes become exceptions.
- Catch `Timeout`, `ConnectionError` and `HTTPError` so network problems never crash your program.
- Keep API keys out of your code.

Next, you will learn a better way to see what your program is doing in [Logging Instead of print()](/courses/python/logging).

<code id="code-content" class="language-python">
# main.py: call a free public JSON API (no key needed) and handle errors gracefully
# Install first, inside your virtual environment:  pip install requests
import requests
#
BASE_URL = "https://jsonplaceholder.typicode.com"
#
#
def get_json(path, **params):
    """GET BASE_URL + path and return the decoded JSON, or None on any problem."""
    url = f"{BASE_URL}{path}"
    try:
        response = requests.get(url, params=params, timeout=5)  # always set a timeout
        response.raise_for_status()  # turn 4xx/5xx status codes into an HTTPError
        return response.json()
    except requests.Timeout:
        print(f"[timeout] {url} took too long")
    except requests.ConnectionError:
        print("[offline] Could not connect. Check your internet connection.")
    except requests.HTTPError as e:
        print(f"[http {e.response.status_code}] {url}")
    except requests.JSONDecodeError:
        print("[bad data] The reply was not JSON")
    return None
#
#
def show_user(user_id):
    user = get_json(f"/users/{user_id}")
    if user is None:
        return
    print(f"{user['name']} ({user['email']}) lives in {user['address']['city']}")
    todos = get_json("/todos", userId=user_id) or []
    done = sum(1 for t in todos if t["completed"])
    print(f"  {done} of {len(todos)} todos completed")
    for todo in todos[:3]:
        mark = "x" if todo["completed"] else " "
        print(f"  [{mark}] {todo['title']}")
#
#
if __name__ == "__main__":
    show_user(1)
    show_user(9999)  # does not exist: handled, no crash
</code></pre>
