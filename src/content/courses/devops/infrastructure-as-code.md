---
publishDate: 2026-10-25T12:05
title: Infrastructure as Code with Terraform
slug: infrastructure-as-code
metadescription: Learn Infrastructure as Code with Terraform, declarative vs imperative tools, providers, resources, variables, outputs, plan and apply, state and locking, drift, modules, IaC in CI/CD, and a real AWS web server example.
updateDate: 2026-10-25T12:05
author: ['bishal-biswas']
level: 3
tags: ['devops', 'terraform', 'iac', 'cloud', 'aws']
course: devops
---

## The trouble with clicking

In [Cloud Computing Basics](/courses/devops/cloud-computing-basics) you saw that you can create servers, networks and databases by clicking in a web console. For learning, that is fine. For anything real, it causes problems that grow over time:

- **Nobody knows exactly what exists**, or why. The person who set it up left last year.
- **Environments drift apart.** Staging was built by hand in March, production in June, and they are subtly different in ways nobody can list.
- **Nothing is reviewed.** One mistyped firewall rule can open a database to the internet, and no one sees it before it happens.
- **Rebuilding is guesswork.** If a region goes down or an account is deleted, recreating everything from memory takes days.

Servers built by hand like this are called **snowflakes**: each one unique, and impossible to recreate exactly.

## What is Infrastructure as Code?

**Infrastructure as Code** (IaC) means describing your infrastructure (servers, networks, firewalls, databases, DNS records) in **text files**, and letting a tool create and update the real thing from them.

Because it is code, infrastructure gets every benefit you have built up in this course:

- it lives in **Git**, with a full history of who changed what and why ([Version Control with Git](/courses/devops/version-control-with-git));
- changes go through **pull requests** and review;
- a **pipeline** can check and apply it automatically ([Continuous Integration](/courses/devops/continuous-integration));
- staging and production can be built from **the same files**, so they really match;
- rebuilding everything from scratch is one command.

### Declarative vs imperative

There are two styles of IaC:

| | Imperative | Declarative |
|---|---|---|
| You write | The **steps**: "create a server, then open port 80" | The **result**: "there should be one server with port 80 open" |
| Running it twice | Might create two servers | Changes nothing the second time |
| Examples | Shell scripts calling cloud CLIs | Terraform, CloudFormation, Bicep, Kubernetes YAML |

Declarative tools work out the steps for you by comparing what you asked for with what exists, the same **desired state** idea you met in [Why Kubernetes?](/courses/devops/why-kubernetes). Running them again and again safely is called being **idempotent**.

## The tools

| Tool | Language | Works with |
|---|---|---|
| **Terraform** | HCL | Almost everything: every major cloud, plus DNS, GitHub, monitoring tools and thousands more |
| **OpenTofu** | HCL | A community-maintained, open-source fork of Terraform; nearly identical to use |
| **Pulumi** | TypeScript, Python, Go, C#... | Many clouds, using a normal programming language |
| **AWS CloudFormation** / **AWS CDK** | YAML or JSON / programming languages | AWS only |
| **Azure Bicep** | Bicep | Azure only |
| **Ansible** | YAML | **Configuring** existing servers (installing software, editing files) |

**Terraform** is the most widely used, and the one you will most often see in job descriptions, so this lesson uses it. In 2023 HashiCorp moved Terraform to a more restrictive "business source" licence, and the community created **OpenTofu** as an open-source fork. For everything in this lesson, the two work the same way: replace `terraform` with `tofu`.

### Provisioning vs configuration

Notice the last row of the table. There are two related jobs:

- **Provisioning** creates the infrastructure itself: "there is a server, in this network, with this firewall". Terraform's job.
- **Configuration management** sets up what runs **inside** servers: "nginx is installed and running". Ansible's job, or cloud-init on first boot, or simply a container image.

Here is a tiny Ansible **playbook**, so you recognise one when you see it:

```yaml
- name: Web servers have nginx
  hosts: web
  become: true                      # use sudo
  tasks:
    - name: Install nginx
      ansible.builtin.apt:
        name: nginx
        state: present
        update_cache: true
    - name: Make sure nginx is running and starts at boot
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

It is declarative too: "nginx is **present**", not "run apt install". With containers, much of this work has moved into Dockerfiles, so many teams today use Terraform plus container images and need little configuration management.

## Terraform concepts

Terraform files end in `.tf` and are written in **HCL**, the HashiCorp Configuration Language. The building blocks:

| Concept | What it is | Example |
|---|---|---|
| **Provider** | A plugin that knows how to talk to one platform's API | `hashicorp/aws`, `hashicorp/azurerm`, `cloudflare/cloudflare` |
| **Resource** | Something Terraform creates and manages | `aws_instance.web`: a server |
| **Data source** | Something Terraform only **reads** | `data.aws_ami.ubuntu`: look up the newest Ubuntu image |
| **Variable** | An input, so the same code works for different cases | `var.region`, `var.instance_type` |
| **Output** | A value printed after apply, or passed to other code | The server's public IP |
| **State** | Terraform's record of what it created | `terraform.tfstate` |

Resources refer to each other by `type.name.attribute`, for example `aws_security_group.web.id`. Terraform reads those references to work out the right **order**: the security group must exist before the server that uses it.

## Hands-on: your first Terraform project (free, no cloud account)

You can learn the whole Terraform workflow without a cloud account or any cost, using two simple providers: `random` (generates random values) and `local` (manages files on your computer). Install Terraform (or OpenTofu) from its official website, create an empty folder, and save this as `main.tf`:

```hcl
terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

variable "environment" {
  type    = string
  default = "dev"
}

resource "random_pet" "server" {
  length = 2
}

resource "local_file" "inventory" {
  filename = "${path.module}/inventory-${var.environment}.txt"
  content  = "web server for ${var.environment}: ${random_pet.server.id}\n"
}

output "server_name" {
  value = random_pet.server.id
}
```

`random_pet` invents a friendly name such as `witty-falcon`, the way some clouds name servers. `local_file` writes a file that uses it. Now the core workflow, the same four commands you will use on real clouds:

### 1. `terraform init`

Downloads the providers named in `required_providers` and prepares the folder. Run it once, and again whenever you add a provider. It also writes a `.terraform.lock.hcl` file recording exact provider versions: commit it, like `package-lock.json`.

### 2. `terraform plan`

Compares your code with what exists and shows what it **would** do, without changing anything:

```text
Terraform will perform the following actions:

  # local_file.inventory will be created
  + resource "local_file" "inventory" {
      + content  = (known after apply)
      + filename = "./inventory-dev.txt"
      ...
    }

  # random_pet.server will be created
  + resource "random_pet" "server" {
      + id        = (known after apply)
      + length    = 2
      + separator = "-"
    }

Plan: 2 to add, 0 to change, 0 to destroy.
```

Learn the symbols, because you will read a lot of plans: `+` create, `~` update in place, `-` destroy, and `-/+` destroy and re-create (**replace**).

### 3. `terraform apply`

Shows the plan again, asks for confirmation, then does it:

```text
Apply complete! Resources: 2 added, 0 changed, 0 destroyed.

Outputs:

server_name = "witty-falcon"
```

Run `terraform apply` again and it reports **no changes**: the real world already matches the code. That is idempotency.

Now change an input and look at the plan:

```bash
terraform plan -var="environment=staging"
```

```text
  # local_file.inventory must be replaced
-/+ resource "local_file" "inventory" {
      ~ filename = "./inventory-dev.txt" -> "./inventory-staging.txt" # forces replacement
      ...
Plan: 1 to add, 0 to change, 1 to destroy.
```

Terraform worked out that a file cannot be renamed in place, so it must be replaced. On a real cloud, "forces replacement" on a database or server means **deleting and re-creating it**, so always read plans carefully before typing `yes`.

### 4. `terraform destroy`

Deletes everything this project manages. On a real cloud, this is how you make sure test environments stop costing money.

## State: Terraform's memory

After `apply`, a file called `terraform.tfstate` appears. It maps each resource in your code to the real object it created (for example, `aws_instance.web` is server `i-0abc123...`). Terraform needs it to know what it manages and what to change.

State needs care:

- **It can contain secrets**, such as database passwords, in plain text. **Never commit it to Git.** Add `*.tfstate`, `*.tfstate.*` and `.terraform/` to `.gitignore`.
- **A team must share one copy.** If two people keep their own state files, each Terraform thinks it owns everything and they overwrite each other's work.
- **Two applies at once corrupt it**, so state needs **locking**.

The answer is a **remote backend**: shared storage with locking, such as an S3 bucket (with `use_lockfile`), Azure Blob Storage, Google Cloud Storage, or HCP Terraform. The code panel shows an example in a comment.

> **Note:** Never edit the state file by hand. When you do need to change it, for example to rename a resource without re-creating it, use commands such as `terraform state mv`, or `moved` blocks in your code.

### Drift

**Drift** is when the real world no longer matches the code, usually because someone changed something by hand "just this once". Every `terraform plan` checks the real resources first, so drift shows up as an unexpected change in the plan. In the local example, delete `inventory-dev.txt` and run `terraform plan`: Terraform notices it is gone and plans to create it again.

Many teams run `terraform plan` on a schedule purely to detect drift, and treat any unexpected change as something to investigate.

## Modules and environments

A **module** is a reusable folder of Terraform code with inputs and outputs, like a function. A team might write a `web-service` module once and use it for every service:

```hcl
module "recipe_api" {
  source        = "./modules/web-service"
  name          = "recipe-api"
  instance_type = "t3.small"
}
```

The public **Terraform Registry** also has thousands of community modules, for example for building a complete VPC.

To run the same code for **staging** and **production**, keep a separate **state** for each, and pass different variables, often from a `.tfvars` file per environment:

```bash
terraform apply -var-file=staging.tfvars
```

## IaC in the pipeline

Infrastructure changes deserve the same pipeline as application code:

```text
pull request opened
  ├─ terraform fmt -check     formatting
  ├─ terraform validate       syntax and references
  ├─ security scan            e.g. Trivy or Checkov: public buckets, open ports...
  └─ terraform plan           posted as a comment on the PR for reviewers to read
merge to main
  └─ terraform apply          the reviewed plan, applied by the pipeline (with approval for production)
```

Reviewers read the **plan**, not just the code: "this PR will destroy 1 database" is impossible to miss. Only the pipeline applies changes to shared environments, so nothing reaches production without review. For credentials, the pipeline should use short-lived **OIDC** access to the cloud rather than stored keys, as you will see in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

## A real web server on AWS

The code panel for this lesson is a complete Terraform configuration for a real server on **AWS**. It:

- looks up the newest official **Ubuntu 24.04** image (a **data source**, owned by Canonical's account);
- creates a **security group** allowing HTTP and HTTPS from anywhere and SSH only from **your** address;
- starts a small **EC2 instance**, set up on first boot by the **cloud-init** file from [Cloud Computing Basics](/courses/devops/cloud-computing-basics);
- tags everything with the project name, and prints the server's IP and an SSH command.

To try it you need an AWS account, the AWS CLI logged in (`aws configure`, or `aws sso login`), and an SSH key. Save the code as `main.tf`. Next to it, save the cloud-init file as `cloud-init.yaml.tftpl`, changing its key line to:

```yaml
      - ${ssh_public_key}
```

`templatefile()` in `main.tf` fills that in with the contents of your public key file. Then:

```bash
terraform init
terraform plan -var="ssh_cidr=$(curl -s https://ifconfig.me)/32"
terraform apply -var="ssh_cidr=$(curl -s https://ifconfig.me)/32"
```

```text
Apply complete! Resources: 6 added, 0 changed, 0 destroyed.

Outputs:

public_ip = "13.233.xx.xx"
ssh_command = "ssh deploy@13.233.xx.xx"
```

`ssh_cidr` has no default, so Terraform requires it: the `$(curl ...)` part fills in your current public IP, so only you can use SSH.

> **Note:** This creates real resources that **cost money** while they exist, although a `t3.micro` is one of the cheapest. When you are finished, run `terraform destroy` with the same `-var` and check the AWS console to be sure.

## Common misunderstandings

### "IaC is just scripts that call the cloud"

A script describes **steps** and usually breaks when run twice. Declarative IaC describes the **result**, works out the steps, shows you a plan first, and is safe to run again and again.

### "With IaC, I must never open the cloud console"

Looking is fine and often useful. **Changing** things by hand is the problem, because the next `terraform apply` will either undo your change or be confused by it.

### "I can keep the state file in Git"

It may contain secrets, and Git has no locking, so two people applying at once will corrupt it. Use a remote backend with locking.

## Quick recap

- **Infrastructure as Code** describes infrastructure in files, so it is versioned, reviewed, repeatable and rebuildable.
- **Declarative** tools such as Terraform describe the desired result and are **idempotent**.
- Terraform uses **providers**, **resources**, **data sources**, **variables** and **outputs**, written in HCL.
- The workflow is **init, plan, apply, destroy**; always read the plan, especially `-/+` replacements.
- **State** maps code to real resources: keep it in a **remote backend with locking**, never in Git.
- Detect **drift** with plans, reuse code with **modules**, and run IaC through a reviewed **pipeline**.

Next, you will learn how to give the same artifact different settings in each environment, safely, in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

<code id="code-content" class="language-hcl">
# main.tf: one Ubuntu web server on AWS, described as code.
# terraform init     download the AWS provider
# terraform plan     preview what will change
# terraform apply    make it so   (and "terraform destroy" when you are done)
terraform {
  required_version = "&gt;= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~&gt; 6.0"
    }
  }
  # For a team, keep state in shared, locked storage instead of on your laptop:
  # backend "s3" {
  #   bucket       = "my-company-terraform-state"
  #   key          = "recipe-api/prod.tfstate"
  #   region       = "ap-south-1"
  #   use_lockfile = true
  # }
}
# ---------- Inputs ----------
variable "region" {
  description = "AWS region to create everything in"
  type        = string
  default     = "ap-south-1"
}
variable "instance_type" {
  description = "Server size"
  type        = string
  default     = "t3.micro"
}
variable "ssh_cidr" {
  description = "Only this address may use SSH, e.g. 203.0.113.7/32"
  type        = string
}
variable "public_key_path" {
  description = "Your SSH public key, put on the server for the deploy user"
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}
provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = "recipe-api"
      ManagedBy = "terraform"
    }
  }
}
# ---------- Look up the newest official Ubuntu 24.04 image ----------
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical, the company behind Ubuntu
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}
# ---------- Firewall: web for everyone, SSH for one address ----------
resource "aws_security_group" "web" {
  name        = "recipe-api-web"
  description = "HTTP and HTTPS from anywhere, SSH from one address"
}
resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.web.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}
resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.web.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}
resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.web.id
  cidr_ipv4         = var.ssh_cidr
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
}
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.web.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1" # all outgoing traffic (updates, packages)
}
# ---------- The server, set up on first boot by cloud-init ----------
resource "aws_instance" "web" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  vpc_security_group_ids = [aws_security_group.web.id]
  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    ssh_public_key = trimspace(file(pathexpand(var.public_key_path)))
  })
  tags = {
    Name = "recipe-api-web"
  }
}
# ---------- Outputs: printed after apply ----------
output "public_ip" {
  value = aws_instance.web.public_ip
}
output "ssh_command" {
  value = "ssh deploy@${aws_instance.web.public_ip}"
}
</code></pre>
