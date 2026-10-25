---
publishDate: 2026-10-25T12:20
title: Encryption at Rest and in Transit
slug: encryption-at-rest-and-in-transit
metadescription: Understand what Azure encrypts by default, when customer managed keys are worth it, and how to enforce encryption in transit.
updateDate: 2026-09-07T12:20
author: ['bishal-biswas']
level: 3
tags: ['security', 'encryption', 'compliance']
course: azure
---

## What is already encrypted

Every Azure storage service encrypts data at rest by default, with Microsoft managed keys, at no cost and with nothing to configure.

```text
Storage accounts    AES-256, always on, cannot be disabled
Managed disks       always on
Azure SQL           Transparent Data Encryption, on by default
Cosmos DB           always on
Service Bus, Event Hubs  always on
Key Vault           always, in FIPS validated modules
Backup and Site Recovery  always on
```

**This is not optional and cannot be turned off.** If a requirement says "data must be encrypted at rest", that box is already ticked before you do anything.

## Customer managed keys

The reason to configure anything is control, not stronger encryption. The algorithm is the same.

```text
Microsoft managed  Microsoft holds and rotates the key. Free, invisible.
Customer managed   your key in Key Vault. You control rotation and revocation.
```

```bash
az keyvault key create --vault-name kv-shop-prod --name storage-cmk \
  --kty RSA --size 3072 --ops wrapKey unwrapKey

IDENTITY_ID=$(az identity show --name id-shop-encryption \
  --resource-group rg-shop-prod-uks --query principalId -o tsv)

az role assignment create --assignee-object-id "$IDENTITY_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Crypto Service Encryption User" \
  --scope /subscriptions/.../vaults/kv-shop-prod

az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --encryption-key-source Microsoft.Keyvault \
  --encryption-key-vault https://kv-shop-prod.vault.azure.net \
  --encryption-key-name storage-cmk \
  --encryption-key-version "" \
  --user-identity-id /subscriptions/.../userAssignedIdentities/id-shop-encryption \
  --identity-type UserAssigned
```

`--encryption-key-version ""` means follow the latest version automatically, so a key rotation is picked up without touching the storage account.

**The key vault must have purge protection and soft delete enabled.** Azure refuses to use a key from a vault that could be permanently deleted, because that would make the data unrecoverable.

## What customer managed keys actually give you

```text
Revocation      remove access to the key and the data is unreadable, immediately
Rotation        on your schedule, and audited
Separation      the platform team holds the key, the application team holds the data
Compliance      some standards require it
```

The revocation property is the real one. Deleting or disabling the key makes the data inaccessible within minutes, which is a genuine control that Microsoft managed keys do not provide.

The cost is operational risk: **lose the key and lose the data.** There is no recovery path, which is exactly the point and also a real hazard.

```bash
az keyvault key set-attributes --vault-name kv-shop-prod --name storage-cmk --enabled false
```

That single command makes the storage account unreadable. Useful in an incident, and dangerous by accident.

Use customer managed keys where a requirement or a genuine threat model calls for them, not by default.

## Encryption at host

```bash
az feature register --namespace Microsoft.Compute --name EncryptionAtHost
az provider register --namespace Microsoft.Compute

az vm update --name vm-shop-01 --resource-group rg-shop-prod-uks \
  --set securityProfile.encryptionAtHost=true
```

Managed disks are encrypted at rest. Encryption at host additionally encrypts the **temporary disk and the host caches**, which platform encryption alone does not cover.

It is free, and the virtual machine must be deallocated to enable it. Worth turning on.

```text
Platform encryption      the persistent disk
Encryption at host       plus the temp disk and caches
Azure Disk Encryption    in guest, BitLocker or dm-crypt. Older, more complex.
Confidential computing   memory encrypted too, on specific VM sizes
```

Azure Disk Encryption is the older in guest approach. Encryption at host is simpler, has no performance cost, and is what to use for new work.

## Double encryption

```bash
az storage account create --name stshopprod --resource-group rg-shop-prod-uks \
  --sku Standard_ZRS --require-infrastructure-encryption true
```

Infrastructure encryption adds a second layer with a separate Microsoft managed key. It protects against a flaw in one encryption implementation, which is a narrow threat.

Must be enabled at creation and cannot be added later. Enable it where a standard requires it, and otherwise do not.

## Encryption in transit

This is the part that needs configuring, because the defaults are more permissive than most people want.

```bash
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --https-only true --min-tls-version TLS1_2

az webapp update --name app-shop --resource-group rg-shop-prod-uks --https-only true
az webapp config set --name app-shop --resource-group rg-shop-prod-uks --min-tls-version 1.2

az sql server update --name sql-shop-prod --resource-group rg-shop-prod-uks \
  --minimal-tls-version 1.2

az redis update --name redis-shop --resource-group rg-shop-prod-uks \
  --set enableNonSslPort=false minimumTlsVersion=1.2
```

TLS 1.0 and 1.1 are deprecated and still accepted by some services unless you set a minimum. Setting it explicitly everywhere is a small change with real value.

Enforce it across the estate rather than per resource:

```bash
az policy assignment create \
  --name require-tls12 \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy fe83a0eb-a853-422d-aac2-1bffd182c5d0 \
  --params '{"effect":{"value":"Deny"}}'
```

## Application level TLS

```csharp
builder.Services.AddHsts(options =>
{
    options.Preload = true;
    options.IncludeSubDomains = true;
    options.MaxAge = TimeSpan.FromDays(365);
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
```

HSTS tells browsers never to attempt HTTP for this domain again, which closes the window where a first request could be intercepted.

`Preload` submits the domain to a browser preload list, and it is difficult to reverse, so understand it before enabling.

## End to end, or terminate at the edge

```text
Terminate at the gateway  the gateway decrypts; backends receive HTTP inside
                          the virtual network. Simplest, one certificate.
End to end                the gateway decrypts, inspects, re-encrypts to the
                          backend. Required by some standards.
```

Application Gateway and Front Door both support either. Terminating at the edge is simpler and adequate when the internal network is trusted; end to end is required when policy says every hop must be encrypted.

## Encryption in use

```bash
az vm create --name vm-confidential --resource-group rg-shop-prod-uks \
  --size Standard_DC4as_v5 \
  --security-type ConfidentialVM \
  --os-disk-security-encryption-type DiskWithVMGuestState \
  --enable-vtpm true --enable-secure-boot true \
  --image Ubuntu2404 --generate-ssh-keys
```

Confidential computing encrypts memory as well as storage and network, using hardware based trusted execution environments. Even the host operating system cannot read the workload's memory.

For most workloads this is unnecessary. It matters for genuinely sensitive processing where the cloud provider is part of the threat model, and it is available for virtual machines, AKS node pools and containers.

## Verifying

```kusto
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| extend
    https = tobool(properties.supportsHttpsTrafficOnly),
    tls = tostring(properties.minimumTlsVersion),
    keySource = tostring(properties.encryption.keySource)
| where https != true or tls != 'TLS1_2'
| project name, resourceGroup, subscriptionId, https, tls, keySource
```

```bash
az storage account show --name stshopprod --resource-group rg-shop-prod-uks \
  --query "{Https:enableHttpsTrafficOnly, Tls:minimumTlsVersion, KeySource:encryption.keySource}"

openssl s_client -connect app-shop.azurewebsites.net:443 -tls1_1 </dev/null
```

That last command should fail if TLS 1.1 is properly disabled, which is worth checking rather than assuming.

## What to actually do

```text
Rely on default encryption at rest, which is already there
Enable encryption at host on virtual machines, since it is free
Set a minimum TLS version everywhere, enforced by policy
Use HTTPS only on every service that offers the setting
Use customer managed keys where a requirement calls for them, not by default
Consider confidential computing only for genuinely sensitive processing
Verify with Resource Graph rather than trusting the configuration
```

The common mistake is spending effort on customer managed keys, which are already covered by default encryption for most purposes, while leaving TLS 1.0 accepted on a public endpoint.

## Quick recap

- Encryption at rest is on by default everywhere and cannot be disabled.
- Customer managed keys give revocation and rotation control, not stronger encryption.
- Losing a customer managed key means losing the data, with no recovery path.
- Encryption at host covers the temporary disk and caches, is free, and needs deallocation.
- Encryption in transit is the part that needs configuring, since defaults are permissive.
- Enforce minimum TLS with policy rather than resource by resource.
- Verify with Resource Graph, and test that old TLS versions are actually refused.

<code id="code-content" class="language-bash">
# ENCRYPTION AT REST IS ALREADY ON EVERYWHERE, with Microsoft managed keys,
# free, and IT CANNOT BE DISABLED. Storage, disks, SQL, Cosmos, Service Bus,
# Key Vault, Backup. "Data must be encrypted at rest" is already satisfied.
# CUSTOMER MANAGED KEYS GIVE CONTROL, NOT STRONGER ENCRYPTION. Same algorithm.
#   revocation  disable the key and the data is unreadable within minutes
#   rotation    on your schedule, audited
#   separation  platform team holds the key, application team holds the data
az keyvault key create --vault-name kv-shop-prod --name storage-cmk \
  --kty RSA --size 3072 --ops wrapKey unwrapKey
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --encryption-key-source Microsoft.Keyvault \
  --encryption-key-vault https://kv-shop-prod.vault.azure.net \
  --encryption-key-name storage-cmk --encryption-key-version "" \
  --user-identity-id /subscriptions/.../userAssignedIdentities/id-shop-encryption
# --encryption-key-version "" follows the LATEST version, so rotation is
# picked up without touching the storage account.
# THE VAULT MUST HAVE PURGE PROTECTION AND SOFT DELETE. Azure refuses a key
# from a vault that could be permanently deleted, because that would make
# the data unrecoverable.
# THE COST IS OPERATIONAL RISK: LOSE THE KEY, LOSE THE DATA. No recovery
# path. This one command makes the account unreadable, which is useful in an
# incident and DANGEROUS BY ACCIDENT:
az keyvault key set-attributes --vault-name kv-shop-prod --name storage-cmk --enabled false
# ENCRYPTION AT HOST covers the TEMPORARY DISK AND HOST CACHES, which
# platform encryption does not. FREE, and needs the VM deallocated. Turn it on.
az vm update --name vm-shop-01 --resource-group rg-shop-prod-uks \
  --set securityProfile.encryptionAtHost=true
# Azure Disk Encryption is the OLDER in guest approach. Encryption at host is
# simpler with no performance cost, and is what to use for new work.
# ENCRYPTION IN TRANSIT IS THE PART THAT NEEDS CONFIGURING, because the
# defaults are MORE PERMISSIVE than most people want. TLS 1.0 and 1.1 are
# deprecated and still accepted unless you set a minimum:
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --https-only true --min-tls-version TLS1_2
az webapp update --name app-shop --resource-group rg-shop-prod-uks --https-only true
az sql server update --name sql-shop-prod --resource-group rg-shop-prod-uks \
  --minimal-tls-version 1.2
az redis update --name redis-shop --resource-group rg-shop-prod-uks \
  --set enableNonSslPort=false minimumTlsVersion=1.2
# ENFORCE ACROSS THE ESTATE rather than resource by resource:
az policy assignment create --name require-tls12 \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy fe83a0eb-a853-422d-aac2-1bffd182c5d0 --params '{"effect":{"value":"Deny"}}'
# VERIFY RATHER THAN ASSUME. This should FAIL:
openssl s_client -connect app-shop.azurewebsites.net:443 -tls1_1 &lt;/dev/null
#   Resources | where type =~ 'microsoft.storage/storageaccounts'
#   | extend https = tobool(properties.supportsHttpsTrafficOnly),
#            tls = tostring(properties.minimumTlsVersion)
#   | where https != true or tls != 'TLS1_2'
# THE COMMON MISTAKE: spending effort on customer managed keys, already
# covered by default encryption for most purposes, while leaving TLS 1.0
# accepted on a public endpoint.
</code></pre>
