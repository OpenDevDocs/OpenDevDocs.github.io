---
publishDate: 2026-10-23T12:00
title: Azure Key Vault
slug: azure-key-vault
metadescription: Store secrets, keys and certificates in Azure Key Vault, control access with RBAC, and rotate without downtime.
updateDate: 2026-09-07T12:00
author: ['bishal-biswas']
level: 2
tags: ['security', 'key vault', 'secrets']
course: azure
---

## Three kinds of object

```text
Secrets       arbitrary strings: connection strings, API keys, passwords
Keys          cryptographic keys, used for operations WITHOUT leaving the vault
Certificates  X.509 certificates, with lifecycle management and auto renewal
```

The distinction between a secret and a key matters. A secret is retrieved and used by your code. A key stays in the vault, and you send data to it for signing or encryption, so the key material never leaves.

```bash
az keyvault create \
  --name kv-shop-prod --resource-group rg-shop-prod-uks \
  --location uksouth \
  --enable-rbac-authorization true \
  --enable-purge-protection true \
  --retention-days 90 \
  --public-network-access Disabled \
  --default-action Deny --bypass AzureServices
```

## RBAC, not access policies

```text
Access policies  the older model. Per vault, not per secret. Separate from Azure RBAC.
RBAC             the current model. Scopable to a single secret, and auditable.
```

`--enable-rbac-authorization true` on every new vault.

```bash
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/.../vaults/kv-shop-prod

# scoped to ONE secret
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/.../vaults/kv-shop-prod/secrets/stripe-key
```

```text
Key Vault Reader                metadata only, no values
Key Vault Secrets User          read secret values
Key Vault Secrets Officer       manage secrets
Key Vault Certificates Officer  manage certificates
Key Vault Crypto User           use keys for operations
Key Vault Administrator         everything
```

**An Owner of the vault cannot read a secret.** These are data plane roles, separate from management. That surprises people and is exactly right.

## Purge protection is permanent

```text
Soft delete       always on. A deleted secret is recoverable for the retention period.
Purge protection  cannot be disabled once enabled. Nobody can permanently delete
                  anything until retention expires, including a subscription owner.
```

That is the point for production and a genuine nuisance in development, where a vault name cannot be reused until retention expires.

```bash
az keyvault list-deleted --output table
az keyvault recover --name kv-shop-dev
az keyvault purge --name kv-shop-dev    # fails if purge protection was enabled
```

Leave purge protection **off** in short lived environments, and on in production.

## Secrets

```bash
az keyvault secret set --vault-name kv-shop-prod --name stripe-key --value "sk_live_..."

az keyvault secret set --vault-name kv-shop-prod --name stripe-key \
  --value "sk_live_..." \
  --expires "2027-09-08T00:00:00Z" \
  --tags owner=payments rotation=annual

az keyvault secret show --vault-name kv-shop-prod --name stripe-key --query value -o tsv
az keyvault secret list --vault-name kv-shop-prod --query "[].{Name:name, Expires:attributes.expires}" -o table
az keyvault secret list-versions --vault-name kv-shop-prod --name stripe-key -o table
```

**Set an expiry on everything.** An expired secret does not stop working automatically, and it does appear in reports and can raise an Event Grid notification, which is how rotation stops being forgotten.

```bash
az keyvault secret list --vault-name kv-shop-prod \
  --query "[?attributes.expires != null && attributes.expires < '2026-12-01'].{Name:name, Expires:attributes.expires}" \
  --output table
```

## Versions

Every write creates a new version, and the old ones remain retrievable.

```bash
# a specific version
az keyvault secret show --vault-name kv-shop-prod --name stripe-key \
  --version 4a3f9c22b1e04d8fa7c6e2d1b8f30a55
```

In an application, **reference without a version** so a rotation is picked up:

```text
https://kv-shop-prod.vault.azure.net/secrets/stripe-key/          latest
https://kv-shop-prod.vault.azure.net/secrets/stripe-key/4a3f9c... pinned
```

Pinning a version means the application keeps using the old secret after rotation, which is the most common Key Vault rotation failure.

## Reading from an application

```csharp
var client = new SecretClient(
    new Uri("https://kv-shop-prod.vault.azure.net/"),
    new DefaultAzureCredential());

KeyVaultSecret secret = await client.GetSecretAsync("stripe-key");
```

```csharp
builder.Configuration.AddAzureKeyVault(
    new Uri(builder.Configuration["KeyVault:Uri"]!),
    new DefaultAzureCredential(),
    new AzureKeyVaultConfigurationOptions
    {
        ReloadInterval = TimeSpan.FromMinutes(30)
    });
```

Loading the vault into configuration means secrets appear as ordinary configuration values. `ReloadInterval` picks up rotations without a restart, and without it a rotated secret is not seen until the app restarts.

Double dash maps to nesting: a secret named `ConnectionStrings--Shop` becomes `ConnectionStrings:Shop`.

**Do not call Key Vault on every request.** It is rate limited, and a busy application will be throttled. Cache, or use configuration binding as above.

## Referencing from App Service

```bash
az webapp config appsettings set --name app-shop --resource-group rg-shop-prod-uks \
  --settings "StripeKey=@Microsoft.KeyVault(SecretUri=https://kv-shop-prod.vault.azure.net/secrets/stripe-key/)"
```

The application reads an ordinary environment variable, and the value never appears in App Service configuration or in any template.

If the reference fails to resolve, the setting arrives as the **literal string**, producing a confusing failure deep in the application. Check the resolution status when a secret looks wrong.

## Certificates

```bash
az keyvault certificate create \
  --vault-name kv-shop-prod --name shop-tls \
  --policy "$(az keyvault certificate get-default-policy)"

# from a public issuer, with auto renewal
az keyvault certificate issuer create \
  --vault-name kv-shop-prod --issuer-name DigiCert --provider DigiCert \
  --account-id "$ACCOUNT" --password "$PASSWORD"
```

Key Vault manages the certificate lifecycle: it generates the key, requests issuance, and renews before expiry. Application Gateway, Front Door and App Service all reference the certificate directly, so a renewal propagates without anyone re-uploading anything.

An expired TLS certificate is one of the most common self inflicted outages, and this removes it.

## Keys and cryptographic operations

```bash
az keyvault key create --vault-name kv-shop-prod --name signing-key \
  --kty RSA --size 2048 --ops sign verify
```

```csharp
var keyClient = new KeyClient(vaultUri, new DefaultAzureCredential());
KeyVaultKey key = await keyClient.GetKeyAsync("signing-key");

var crypto = new CryptographyClient(key.Id, new DefaultAzureCredential());
SignResult result = await crypto.SignDataAsync(SignatureAlgorithm.RS256, data);
```

The private key never leaves the vault. Your code sends the data and receives a signature, so a compromised application cannot steal the key.

For higher assurance, Managed HSM stores keys in FIPS 140-3 Level 3 hardware, with the tradeoff of a significantly higher cost and its own access model.

## Rotation

```bash
az keyvault secret set-attributes --vault-name kv-shop-prod --name stripe-key \
  --expires "2027-09-08T00:00:00Z"
```

```text
1. Create the new credential in the target system, keeping the old valid
2. Write the new value to Key Vault, creating a new version
3. Applications pick it up: on ReloadInterval, at restart, or via notification
4. Confirm nothing uses the old credential
5. Revoke the old credential
```

Both being valid during the transition is what avoids downtime.

```bash
az eventgrid event-subscription create \
  --name secret-expiry --source-resource-id /subscriptions/.../vaults/kv-shop-prod \
  --endpoint /subscriptions/.../functions/RotateSecret --endpoint-type azurefunction \
  --included-event-types Microsoft.KeyVault.SecretNearExpiry
```

Key Vault raises an Event Grid event before a secret expires. A function handling that event can rotate automatically, which is the difference between rotation happening and rotation being intended.

## Networking

```bash
az keyvault update --name kv-shop-prod --resource-group rg-shop-prod-uks \
  --public-network-access Disabled

az network private-endpoint create \
  --name pe-kv-shop --resource-group rg-shop-prod-uks \
  --vnet-name vnet-shop-prod-uks --subnet snet-privatelink \
  --private-connection-resource-id /subscriptions/.../vaults/kv-shop-prod \
  --group-id vault --connection-name pe-kv-shop-conn
```

The private DNS zone is `privatelink.vaultcore.azure.net`, not `vault.azure.net`. That distinction catches people.

## Logging

```bash
az monitor diagnostic-settings create \
  --name kv-audit --resource /subscriptions/.../vaults/kv-shop-prod \
  --workspace /subscriptions/.../workspaces/law-shop \
  --logs '[{"category":"AuditEvent","enabled":true}]'
```

```kusto
AzureDiagnostics
| where ResourceType == "VAULTS"
| where OperationName in ("SecretGet", "SecretSet", "SecretDelete")
| project TimeGenerated, OperationName, id_s, identity_claim_upn_s, CallerIPAddress, ResultSignature
| order by TimeGenerated desc
```

Every access is logged. Enabling this before you need it is the difference between answering "who read that secret" and guessing.

## Limits

```text
Requests are throttled per vault, and the limits are lower than people expect
Secrets are up to 25 KB
Use several vaults rather than one for everything
```

Separate vaults per environment and per application limit both throttling and blast radius. One vault holding every secret in the organisation is both a bottleneck and a single point of compromise.

## Quick recap

- Secrets leave the vault, keys stay in it and perform operations for you.
- Use RBAC rather than access policies, and note an Owner still cannot read a secret.
- Purge protection cannot be disabled, so leave it off in short lived environments.
- Set expiry on everything, and handle the near expiry event to automate rotation.
- Reference secrets without a version, or applications keep using the old value.
- Do not call Key Vault per request, since it is rate limited.
- The private DNS zone is `privatelink.vaultcore.azure.net`.

<code id="code-content" class="language-bash">
# THREE KINDS. The distinction matters: a SECRET is retrieved and used by
# your code. A KEY STAYS IN THE VAULT and performs operations for you, so
# the key material NEVER LEAVES. CERTIFICATES add lifecycle and renewal.
az keyvault create --name kv-shop-prod --resource-group rg-shop-prod-uks \
  --enable-rbac-authorization true --enable-purge-protection true \
  --retention-days 90 --public-network-access Disabled \
  --default-action Deny --bypass AzureServices
# RBAC, NOT ACCESS POLICIES. Policies are per vault, separate from Azure
# RBAC, and cannot scope to one secret.
az role assignment create --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal --role "Key Vault Secrets User" \
  --scope /subscriptions/.../vaults/kv-shop-prod/secrets/stripe-key
# AN OWNER OF THE VAULT CANNOT READ A SECRET. These are DATA PLANE roles,
# separate from management. Surprising, and exactly right.
# PURGE PROTECTION CANNOT BE DISABLED ONCE ENABLED. Nobody can permanently
# delete anything until retention expires, INCLUDING a subscription owner,
# and the vault NAME cannot be reused. Leave it OFF in dev, ON in production.
az keyvault secret set --vault-name kv-shop-prod --name stripe-key \
  --value "sk_live_..." --expires "2027-09-08T00:00:00Z" --tags owner=payments
# SET EXPIRY ON EVERYTHING. It does not stop the secret working, and it
# does put it in reports and raise an event, which is how rotation stops
# being forgotten:
az keyvault secret list --vault-name kv-shop-prod -o table \
  --query "[?attributes.expires &lt; '2026-12-01'].{Name:name, Expires:attributes.expires}"
# REFERENCE WITHOUT A VERSION, or the application KEEPS USING THE OLD SECRET
# after rotation. That is the most common Key Vault rotation failure.
#   .../secrets/stripe-key/          latest     &lt;- this one
#   .../secrets/stripe-key/4a3f9c... pinned
# IN CODE, load into configuration with a ReloadInterval so rotations are
# picked up WITHOUT A RESTART. DO NOT CALL KEY VAULT PER REQUEST: it is
# rate limited and a busy application will be throttled.
#   builder.Configuration.AddAzureKeyVault(uri, cred,
#     new AzureKeyVaultConfigurationOptions { ReloadInterval = TimeSpan.FromMinutes(30) });
# FROM APP SERVICE, the value never appears in configuration or a template.
# IF THE REFERENCE FAILS TO RESOLVE, THE SETTING ARRIVES AS THE LITERAL
# STRING, failing confusingly deep inside the application.
az webapp config appsettings set --name app-shop --resource-group rg-shop-prod-uks \
  --settings "StripeKey=@Microsoft.KeyVault(SecretUri=https://kv-shop-prod.vault.azure.net/secrets/stripe-key/)"
# CERTIFICATES: Key Vault generates the key, requests issuance and RENEWS
# BEFORE EXPIRY. Application Gateway, Front Door and App Service reference
# it directly, so renewal propagates with nobody re-uploading anything.
# That removes one of the most common self inflicted outages.
az keyvault certificate create --vault-name kv-shop-prod --name shop-tls \
  --policy "$(az keyvault certificate get-default-policy)"
# AUTOMATE ROTATION by handling the near expiry event. That is the
# difference between rotation HAPPENING and rotation being INTENDED:
az eventgrid event-subscription create --name secret-expiry \
  --source-resource-id /subscriptions/.../vaults/kv-shop-prod \
  --endpoint /subscriptions/.../functions/RotateSecret --endpoint-type azurefunction \
  --included-event-types Microsoft.KeyVault.SecretNearExpiry
# The private DNS zone is privatelink.VAULTCORE.azure.net, not vault.azure.net.
# LOG BEFORE YOU NEED IT. This is the difference between answering "who read
# that secret" and guessing:
#   AzureDiagnostics | where ResourceType == "VAULTS"
#   | where OperationName in ("SecretGet","SecretSet","SecretDelete")
#   | project TimeGenerated, OperationName, id_s, identity_claim_upn_s, CallerIPAddress
</code></pre>
