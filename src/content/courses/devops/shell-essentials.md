---
publishDate: 2026-10-25T10:30
title: Essential Shell Commands and Bash Scripting
slug: shell-essentials
metadescription: Learn the Linux shell commands DevOps engineers use every day, from moving around and reading logs to pipes, redirection, exit codes and writing safe Bash scripts.
updateDate: 2026-10-25T10:30
author: ['bishal-biswas']
level: 1
tags: ['devops', 'linux', 'bash', 'shell', 'scripting']
course: devops
---

## The shell and the terminal

Two words get mixed up all the time:

- The **terminal** is the window you type into.
- The **shell** is the program inside it that reads your commands and runs them.

The most common shell on Linux servers is **Bash** (the "Bourne Again SHell"). macOS uses **zsh** by default, which accepts almost all the same commands. Everything in this lesson works in both.

When the shell is ready for a command, it shows a **prompt**, often something like:

```text
deploy@web-01:~$
```

That reads as: user `deploy`, on the machine `web-01`, in the folder `~` (your home folder), and `$` means you are a normal user. A `#` instead of `$` means you are **root**, the administrator, so be careful.

> **Note:** In this course, a `bash` code block shows commands you type, and a `text` block shows what the computer prints back. Lines starting with `#` inside commands are comments: the shell ignores them.

## Moving around

The file system is a tree of folders (see [Linux for DevOps](/courses/devops/linux-for-devops)). You are always "standing" in one folder, called the **working directory**.

```bash
pwd                  # print working directory: where am I?
ls                   # list what is here
ls -la               # list everything, including hidden files, with details
cd /var/log          # go to an absolute path (starts with /)
cd nginx             # go into a folder relative to where you are
cd ..                # go up one level
cd ~                 # go home (just "cd" does the same)
cd -                 # go back to the previous folder
```

> **Tip:** Press **Tab** to auto-complete file and folder names. Press it twice to see all the options. Press the **Up arrow** to bring back previous commands. These two keys will save you hours.

## Working with files and folders

```bash
mkdir -p app/config        # make a folder (-p also makes any missing parents)
touch app/config/app.env   # create an empty file
cp app.env app.env.bak     # copy a file
cp -r app app-backup       # copy a whole folder (-r means recursive)
mv app.env.bak old.env     # move or rename
rm old.env                 # delete a file
rm -r app-backup           # delete a folder and everything in it
```

> **Note:** There is **no recycle bin** on the command line. `rm` deletes immediately and for good. Be especially careful with `rm -rf`, which deletes folders without asking. Double-check the path before pressing Enter, and never run it as root unless you are certain.

## Reading files

As a DevOps engineer you will read a lot of config files and logs:

```bash
cat app.env                       # print a whole (short) file
less /var/log/syslog              # scroll through a long file (q to quit, / to search)
head -n 20 access.log             # the first 20 lines
tail -n 50 access.log             # the last 50 lines
tail -f /var/log/nginx/error.log  # follow: show new lines as they are written
```

`tail -f` is one of the most useful commands you will learn. Open it in one terminal, reproduce a bug in your browser, and watch the error appear live.

## Finding things

```bash
grep "error" app.log              # lines containing "error"
grep -i "error" app.log           # ...ignoring upper/lower case
grep -rn "DATABASE_URL" ./src     # search every file in a folder, show line numbers
grep -v "healthcheck" access.log  # lines that do NOT match

find /etc -name "*.conf"          # files whose names end in .conf
find /var/log -mtime -1           # files changed in the last day
find . -size +100M                # files bigger than 100 MB
```

## Pipes: the shell's superpower

Most shell commands do one small job well. The **pipe** `|` sends the output of one command into the input of the next, so you can snap small commands together like LEGO bricks.

```bash
# How many lines in the log contain "error"?
grep -i "error" app.log | wc -l

# Which 5 IP addresses visit the site most?
awk '{ print $1 }' access.log | sort | uniq -c | sort -rn | head -n 5
```

Let us read that second one brick by brick:

| Step | Command | What it does |
|---|---|---|
| 1 | `awk '{ print $1 }' access.log` | Print the first word of each line (the visitor's IP) |
| 2 | `sort` | Put identical IPs next to each other |
| 3 | `uniq -c` | Collapse repeats into one line, with a count in front |
| 4 | `sort -rn` | Sort by that count, biggest first (**r**everse, **n**umeric) |
| 5 | `head -n 5` | Keep the top five |

`awk` is a small language for working with columns of text. You only need `awk '{ print $N }'` (print column N) to get a lot done.

## Redirection: saving output

By default, commands print to the screen. **Redirection** sends that output to a file instead:

```bash
ls -la > listing.txt           # write to a file (replaces what was there)
echo "deployed v1.4" >> deploy.log   # append to the end of a file
grep "error" app.log 2> /dev/null    # throw away error messages
./deploy.sh > deploy.log 2>&1        # save normal output AND errors to one file
```

Programs actually have two output streams: **stdout** (normal output, number 1) and **stderr** (errors, number 2). `2>` redirects only errors. `2>&1` means "send errors to the same place as normal output". `/dev/null` is a special file that swallows anything written to it.

## Variables and the environment

```bash
name="web-01"                  # no spaces around =
echo "Deploying to $name"      # use it with $
echo "Today is $(date +%F)"    # $( ) runs a command and inserts its output
```

```text
Deploying to web-01
Today is 2026-10-25
```

**Environment variables** are variables passed down to every program you start. They are how most apps receive settings such as database addresses and API keys:

```bash
export NODE_ENV=production     # make it visible to programs started from here
echo $HOME                     # your home folder
echo $PATH                     # the folders the shell searches for programs
env                            # list every environment variable
```

You will use these a lot in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

## Exit codes: did it work?

Every command finishes with an **exit code**: `0` means success, anything else means something went wrong. The special variable `$?` holds the last one:

```bash
grep -q "nginx" /etc/passwd
echo $?        # 0 if found, 1 if not
```

You can chain commands based on success or failure:

```bash
npm test && npm run deploy     # deploy ONLY if the tests passed
ping -c 1 db || echo "Database is unreachable"   # run the second only if the first failed
```

This is exactly how CI pipelines decide whether to carry on: a step that exits with anything other than `0` stops the pipeline.

## Your first Bash script

A script is just a text file of commands. Here is a small one:

```bash
#!/usr/bin/env bash
# backup.sh: copy a folder into a dated archive
set -euo pipefail

SOURCE="${1:-./app}"               # first argument, or ./app if none given
DEST="backups/app-$(date +%F).tar.gz"

if [ ! -d "$SOURCE" ]; then
  echo "Folder not found: $SOURCE" >&2
  exit 1
fi

mkdir -p backups
tar -czf "$DEST" "$SOURCE"
echo "Backed up $SOURCE to $DEST"
```

Run it:

```bash
chmod +x backup.sh     # make it executable (once)
./backup.sh ./app
```

```text
Backed up ./app to backups/app-2026-10-25.tar.gz
```

The important parts:

- **`#!/usr/bin/env bash`** is the **shebang**. It tells the system which program should run this file.
- **`set -euo pipefail`** is the safety line. `-e` stops at the first failing command, `-u` stops if you use a variable that was never set (a typo like `$SOUCRE`), and `-o pipefail` makes a pipeline fail if any part of it fails. Put it at the top of almost every script.
- **`$1`, `$2` ...** are the arguments passed to the script.
- **`${1:-./app}`** means "use `$1`, or `./app` if it is empty".
- **Quote your variables**: `"$SOURCE"`, not `$SOURCE`. Without quotes, a folder called `my app` would be treated as two separate words, `my` and `app`.
- **`>&2`** sends error messages to stderr, where they belong.

### Loops and functions

```bash
#!/usr/bin/env bash
set -euo pipefail

check() {                                  # a function: a named group of commands
  if curl -fsS --max-time 5 "$1" > /dev/null; then
    echo "UP    $1"
  else
    echo "DOWN  $1"
  fi
}

for url in https://example.com https://example.org; do
  check "$url"
done
```

```text
UP    https://example.com
UP    https://example.org
```

That is a tiny uptime checker in a dozen lines. Scripts like this are the start of almost all automation.

## Putting it together: a log report

The code panel for this lesson has a script that answers real questions about a web server's access log using only the pipes you have just learned. If you do not give it a log file, it writes a small sample one first:

```bash
bash log-report.sh
```

```text
No log given, so I wrote a sample one: sample-access.log
Requests:   12
Unique IPs: 4

Requests per status code:
      7 200
      3 404
      1 502
      1 500

Top 3 visitors:
      4 203.0.113.5
      4 198.51.100.7
      3 192.0.2.33

Most requested pages:
      3 /recipes
      2 /api/comments
      1 /wp-login.php

Server errors (5xx):
25/Oct/2026:10:03:41 /api/comments 500
25/Oct/2026:10:04:10 /api/comments 502

Possible scanners (3 or more 404s):
192.0.2.33 (3 not-found requests)
```

From twelve lines of log you already learn two useful things: the comments API is failing, and `192.0.2.33` is a bot probing for common weak spots such as `/wp-login.php` and `/.env`. On a real server, point it at the real log:

```bash
sudo bash log-report.sh /var/log/nginx/access.log
```

## Common misunderstandings

### "I need to memorise every command and flag"

Nobody does. Use `man ls` (the manual page) or `ls --help` to look things up. What matters is knowing which **kind** of command solves a problem, so you know what to search for.

### "Bash scripts are only for small jobs"

Bash is perfect for gluing commands together, up to a hundred lines or so. Beyond that, error handling and data structures get painful, and Python or Go is often a better choice. Most DevOps engineers use both.

### "Spaces do not matter"

In Bash they matter a lot. `name = "web"` (with spaces) tries to run a command called `name`. `[ -f "$file" ]` needs spaces inside the brackets. If a script fails strangely, check the spaces first.

## Quick recap

- The **terminal** is the window; the **shell** (usually Bash) runs your commands.
- Move with `pwd`, `ls`, `cd`; manage files with `mkdir`, `cp`, `mv`, `rm` (no undo!).
- Read with `cat`, `less`, `head`, `tail -f`; search with `grep` and `find`.
- **Pipes** `|` chain small commands; **redirection** `>`, `>>`, `2>&1` saves output.
- Exit code `0` means success; `&&` and `||` act on it.
- Start scripts with a shebang and `set -euo pipefail`, and always quote your variables.

Next, you will log in to a real server securely in [SSH, Users and Permissions on a Server](/courses/devops/ssh-users-and-permissions).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# log-report.sh: answer real questions about a web server log with one-line pipelines.
# Run it with: bash log-report.sh                      (uses a built-in sample log)
#          or: bash log-report.sh /var/log/nginx/access.log
set -eu                                  # stop on errors and on unset variables
LOG="${1:-sample-access.log}"
# No log given? Write a small sample in nginx's "combined" format.
if [ ! -f "$LOG" ]; then
  cat &gt; "$LOG" &lt;&lt;'EOF'
203.0.113.5 - - [25/Oct/2026:10:00:01 +0000] "GET / HTTP/1.1" 200 5120 "-" "Mozilla/5.0"
203.0.113.5 - - [25/Oct/2026:10:00:02 +0000] "GET /css/site.css HTTP/1.1" 200 2048 "-" "Mozilla/5.0"
198.51.100.7 - - [25/Oct/2026:10:00:05 +0000] "GET /recipes HTTP/1.1" 200 8192 "-" "Mozilla/5.0"
198.51.100.7 - - [25/Oct/2026:10:00:09 +0000] "GET /recipes/42 HTTP/1.1" 200 4096 "-" "Mozilla/5.0"
192.0.2.33 - - [25/Oct/2026:10:01:12 +0000] "GET /wp-login.php HTTP/1.1" 404 512 "-" "curl/8.5.0"
192.0.2.33 - - [25/Oct/2026:10:01:13 +0000] "GET /.env HTTP/1.1" 404 512 "-" "curl/8.5.0"
192.0.2.33 - - [25/Oct/2026:10:01:14 +0000] "GET /admin HTTP/1.1" 404 512 "-" "curl/8.5.0"
203.0.113.5 - - [25/Oct/2026:10:02:30 +0000] "POST /api/login HTTP/1.1" 200 256 "-" "Mozilla/5.0"
198.51.100.7 - - [25/Oct/2026:10:03:41 +0000] "POST /api/comments HTTP/1.1" 500 128 "-" "Mozilla/5.0"
203.0.113.5 - - [25/Oct/2026:10:04:02 +0000] "GET /recipes HTTP/1.1" 200 8192 "-" "Mozilla/5.0"
198.51.100.7 - - [25/Oct/2026:10:04:10 +0000] "POST /api/comments HTTP/1.1" 502 128 "-" "Mozilla/5.0"
203.0.113.9 - - [25/Oct/2026:10:05:00 +0000] "GET /recipes HTTP/1.1" 200 8192 "-" "Mozilla/5.0"
EOF
  echo "No log given, so I wrote a sample one: $LOG"
fi
# In this format, field 1 is the IP, field 7 the path and field 9 the status code.
echo "Requests:   $(wc -l &lt; "$LOG")"
echo "Unique IPs: $(awk '{ print $1 }' "$LOG" | sort -u | wc -l)"
echo
echo "Requests per status code:"
awk '{ print $9 }' "$LOG" | sort | uniq -c | sort -rn
echo
echo "Top 3 visitors:"
awk '{ print $1 }' "$LOG" | sort | uniq -c | sort -rn | head -n 3
echo
echo "Most requested pages:"
awk '{ print $7 }' "$LOG" | sort | uniq -c | sort -rn | head -n 3
echo
echo "Server errors (5xx):"
awk '$9 &gt;= 500 { print $4, $7, $9 }' "$LOG" | tr -d '['
echo
echo "Possible scanners (3 or more 404s):"
awk '$9 == 404 { print $1 }' "$LOG" | sort | uniq -c | awk '$1 &gt;= 3 { print $2, "(" $1 " not-found requests)" }'
</code></pre>
