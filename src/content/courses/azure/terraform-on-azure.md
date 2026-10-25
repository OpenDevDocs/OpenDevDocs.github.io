---
publishDate: 2026-10-19T10:55
title: Terraform on Azure
slug: terraform-on-azure
metadescription: Use Terraform with the AzureRM provider, manage state safely, and understand where it differs from Bicep in practice.
updateDate: 2026-09-07T10:55
author: ['bishal-biswas']
level: 3
tags: ['iac', 'terraform', 'azure']
course: azure
---

## When Terraform fits

```text
Multi cloud, or cloud plus SaaS providers in one configuration
An existing Terraform estate and expertise
A need for the module ecosystem
A team that already thinks in Terraform
```

For Azure only work with no existing investment, Bicep is simpler. Terraform earns its place through breadth: the same tool configures Azure, Cloudflare, Datadog, GitHub and a database schema in one plan.

## Provider and backend

```hcl
terraform {
  required_version = ">= 1.9.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "rg-tfstate"
    storage_account_name = "sttfstateshop"
    container_name       = "tfstate"
    key                  = "shop-prod.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }
  storage_use_azuread = true
}
```

**Pin the provider version.** AzureRM introduces breaking changes at major versions, and an unpinned configuration will eventually fail on a machine that fetched a newer provider.

`use_azuread_auth` on the backend means state access uses Entra ID rather than a storage account key, which is the right way.

## State, and protecting it

```bash
az group create --name rg-tfstate --location uksouth

az storage account create \
  --name sttfstateshop --resource-group rg-tfstate \
  --sku Standard_ZRS --allow-shared-key-access false \
  --min-tls-version TLS1_2

az storage container create \
  --name tfstate --account-name sttfstateshop --auth-mode login

az storage account blob-service-properties update \
  --account-name sttfstateshop --resource-group rg-tfstate \
  --enable-versioning true --enable-delete-retention true --delete-retention-days 30

az lock create --name protect-state --lock-type CanNotDelete \
  --resource-group rg-tfstate
```

The state file contains **resource identifiers and, for some resources, secret values in plain text.** Treat it as sensitive: private endpoint or firewall rules, RBAC controlled access, versioning enabled, and a delete lock on the resource group.

The azurerm backend takes a blob lease as a lock, so two people cannot apply at once. That is automatic and worth knowing about when a lease is left behind by an interrupted run:

```bash
terraform force-unlock LOCK_ID
```

Use that only when you are certain no apply is running.

## Separate state per environment

```text
environments/
  dev/
    main.tf
    terraform.tfvars
    backend.tf     -> key = "shop-dev.tfstate"
  prod/
    main.tf
    terraform.tfvars
    backend.tf     -> key = "shop-prod.tfstate"
modules/
  network/
  app-service/
  storage/
```

One state file per environment, so a mistake in dev cannot touch production. Workspaces are an alternative and share a backend configuration, which makes them easier to misuse.

## Resources

```hcl
resource "azurerm_resource_group" "shop" {
  name     = "rg-shop-${var.environment}-uks"
  location = var.location
  tags     = local.tags
}

resource "azurerm_service_plan" "shop" {
  name                = "plan-shop-${var.environment}"
  resource_group_name = azurerm_resource_group.shop.name
  location            = azurerm_resource_group.shop.location
  os_type             = "Linux"
  sku_name            = var.environment == "prod" ? "P1v3" : "B1"
  tags                = local.tags
}

resource "azurerm_linux_web_app" "shop" {
  name                = "app-shop-${var.environment}"
  resource_group_name = azurerm_resource_group.shop.name
  location            = azurerm_service_plan.shop.location
  service_plan_id     = azurerm_service_plan.shop.id
  https_only          = true

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.shop.id]
  }

  site_config {
    always_on              = var.environment == "prod"
    minimum_tls_version    = "1.2"
    ftps_state             = "Disabled"
    health_check_path      = "/healthz"

    application_stack {
      dotnet_version = "8.0"
    }
  }

  app_settings = {
    AZURE_CLIENT_ID = azurerm_user_assigned_identity.shop.client_id
    StripeKey       = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.stripe.versionless_id})"
  }

  key_vault_reference_identity_id = azurerm_user_assigned_identity.shop.id

  lifecycle {
    ignore_changes = [
      app_settings["WEBSITE_RUN_FROM_PACKAGE"],
      tags["deployedAt"],
    ]
  }
}
```

`ignore_changes` matters in practice. Deployment pipelines and Azure itself set some values, and without this Terraform reverts them on the next apply, producing a loop between the two systems.

## Variables and locals

```hcl
variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "environment must be dev, test or prod."
  }
}

variable "subnets" {
  type = map(object({
    prefix     = string
    delegation = optional(string)
  }))
  default = {
    app  = { prefix = "10.20.1.0/24", delegation = "Microsoft.Web/serverFarms" }
    data = { prefix = "10.20.2.0/24" }
  }
}

locals {
  is_production = var.environment == "prod"

  tags = {
    environment = var.environment
    application = "shop"
    managedBy   = "terraform"
  }

  sku = {
    dev  = "B1"
    test = "S1"
    prod = "P1v3"
  }[var.environment]
}
```

Typed variables with validation catch mistakes before an apply starts, and the error message is far clearer than a provider rejection halfway through.

## Loops

```hcl
# for_each keyed by name: adding one does not disturb the others
resource "azurerm_subnet" "subnets" {
  for_each = var.subnets

  name                 = "snet-${each.key}"
  resource_group_name  = azurerm_resource_group.shop.name
  virtual_network_name = azurerm_virtual_network.shop.name
  address_prefixes     = [each.value.prefix]

  dynamic "delegation" {
    for_each = each.value.delegation != null ? [each.value.delegation] : []
    content {
      name = "delegation"
      service_delegation {
        name = delegation.value
      }
    }
  }
}
```

**Prefer `for_each` over `count`.** With `count`, resources are tracked by index, so removing the first item in a list causes every subsequent resource to be destroyed and recreated. With `for_each` they are tracked by key, and removing one affects only that one.

That difference has caused real production incidents, and it is a one word change.

## Role assignments

```hcl
resource "azurerm_user_assigned_identity" "shop" {
  name                = "id-shop-${var.environment}"
  resource_group_name = azurerm_resource_group.shop.name
  location            = azurerm_resource_group.shop.location
}

resource "azurerm_role_assignment" "blob" {
  scope                = azurerm_storage_account.shop.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.shop.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "secrets" {
  scope                = azurerm_key_vault.shop.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.shop.principal_id
  principal_type       = "ServicePrincipal"
}
```

`role_definition_name` accepts the friendly name, which is more readable than a GUID. `principal_type` prevents the same replication race that affects Bicep.

## Plan, apply, and reading the plan

```bash
terraform init -upgrade
terraform fmt -recursive
terraform validate

terraform plan -out=tfplan -var-file=prod.tfvars
terraform show -json tfplan | jq '.resource_changes[] | select(.change.actions[0] != "no-op") | {address, actions: .change.actions}'

terraform apply tfplan
```

Saving the plan to a file and applying that exact plan is the correct discipline. Applying without a saved plan means the change applied might differ from the change reviewed.

**Read the plan for replacements.** `-/+ destroy and then create replacement` on a database or a storage account means data loss, and it happens when an immutable property changes.

```hcl
lifecycle {
  prevent_destroy = true
}
```

Add that to anything stateful. It turns an accidental destroy into an error.

## Importing existing resources

```hcl
import {
  to = azurerm_resource_group.shop
  id = "/subscriptions/0000.../resourceGroups/rg-shop-prod-uks"
}
```

```bash
terraform plan -generate-config-out=generated.tf
```

Import blocks in configuration are much better than the old `terraform import` command, because they are reviewable and can generate a starting configuration.

Bringing an existing estate under Terraform is still substantial work, and generated configuration always needs tidying.

## Authenticating from CI

```yaml
permissions:
  id-token: write
  contents: read

env:
  ARM_USE_OIDC: true
  ARM_CLIENT_ID: ${{ vars.AZURE_CLIENT_ID }}
  ARM_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}
  ARM_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

Workload identity federation, with no client secret. `ARM_USE_OIDC` is all the provider needs.

## Terraform against Bicep, practically

```text
Terraform          Bicep
state file         no state, compares against Azure directly
plan               what-if
providers          Azure only
huge module registry  Azure Verified Modules
new Azure features wait for a provider release  available immediately
destroy is explicit  complete mode deployment
multi cloud        no
```

The state file is the largest practical difference. It is what makes `plan` accurate and detailed, and it is a thing to secure, back up and occasionally repair.

Neither is wrong. Choose by team and estate, then be consistent.

## Quick recap

- Pin the provider version, since AzureRM breaks at major versions.
- The state file holds secrets, so lock it down, version it and protect the resource group.
- One state file per environment, so a dev mistake cannot reach production.
- Prefer `for_each` over `count`, or removing a list item recreates everything after it.
- Use `ignore_changes` for values set by pipelines or Azure itself.
- Save the plan and apply that file, and read it for replacements before applying.
- Add `prevent_destroy` to anything stateful.

<code id="code-content" class="language-hcl">
terraform {
  required_providers {
    # PIN IT. AzureRM breaks at major versions, and an unpinned config will
    # eventually fail on a machine that fetched a newer provider.
    azurerm = { source = "hashicorp/azurerm", version = "~&gt; 4.0" }
  }
  backend "azurerm" {
    resource_group_name  = "rg-tfstate"
    storage_account_name = "sttfstateshop"
    container_name       = "tfstate"
    key                  = "shop-prod.tfstate"   # ONE STATE PER ENVIRONMENT
    use_azuread_auth     = true                  # not a storage account key
  }
}
# THE STATE FILE CONTAINS SECRET VALUES IN PLAIN TEXT for some resources.
# Private endpoint or firewall it, control access with RBAC, enable blob
# VERSIONING, and put a CanNotDelete lock on the resource group.
#
resource "azurerm_linux_web_app" "shop" {
  name                            = "app-shop-${var.environment}"
  service_plan_id                 = azurerm_service_plan.shop.id
  https_only                      = true
  key_vault_reference_identity_id = azurerm_user_assigned_identity.shop.id
#
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.shop.id]
  }
#
  app_settings = {
    AZURE_CLIENT_ID = azurerm_user_assigned_identity.shop.client_id
    StripeKey = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.stripe.versionless_id})"
  }
#
  lifecycle {
    # PIPELINES AND AZURE ITSELF SET SOME VALUES. Without this, Terraform
    # reverts them on the next apply, producing a loop between the two.
    ignore_changes = [app_settings["WEBSITE_RUN_FROM_PACKAGE"]]
  }
}
#
# PREFER for_each OVER count. With count, resources are tracked BY INDEX,
# so removing the FIRST item destroys and recreates EVERYTHING AFTER IT.
# With for_each they are tracked BY KEY, so removing one affects only that
# one. A one word change that has caused real production incidents.
resource "azurerm_subnet" "subnets" {
  for_each         = var.subnets
  name             = "snet-${each.key}"
  address_prefixes = [each.value.prefix]
#
  dynamic "delegation" {
    for_each = each.value.delegation != null ? [each.value.delegation] : []
    content {
      name = "delegation"
      service_delegation { name = delegation.value }
    }
  }
}
#
resource "azurerm_role_assignment" "blob" {
  scope                = azurerm_storage_account.shop.id
  role_definition_name = "Storage Blob Data Contributor"   # friendlier than a GUID
  principal_id         = azurerm_user_assigned_identity.shop.principal_id
  principal_type       = "ServicePrincipal"   # avoids the replication race
}
#
# ADD THIS TO ANYTHING STATEFUL. It turns an accidental destroy into an error.
#   lifecycle { prevent_destroy = true }
#
# SAVE THE PLAN AND APPLY THAT FILE, or the change applied may differ from
# the change reviewed:
#   terraform plan -out=tfplan -var-file=prod.tfvars
#   terraform apply tfplan
# READ THE PLAN FOR REPLACEMENTS. "-/+ destroy and then create replacement"
# on a database or storage account MEANS DATA LOSS, and it happens when an
# immutable property changes.
#
# CI AUTHENTICATION WITH NO SECRET. ARM_USE_OIDC is all the provider needs,
# alongside id-token: write in the workflow permissions.
#   ARM_USE_OIDC=true ARM_CLIENT_ID=... ARM_TENANT_ID=... ARM_SUBSCRIPTION_ID=...
#
# IMPORT BLOCKS beat the old command: reviewable, and they can generate a
# starting configuration with terraform plan -generate-config-out=generated.tf
#   import { to = azurerm_resource_group.shop, id = "/subscriptions/.../rg-..." }
</code></pre>
