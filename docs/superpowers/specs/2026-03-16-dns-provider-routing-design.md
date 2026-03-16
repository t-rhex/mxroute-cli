# DNS Provider Routing Design Spec

**Date:** 2026-03-16
**Branch:** TBD (feat/dns-provider-routing)
**Status:** Draft (rev 2 — post-review fixes)

## Problem

MXroute's `add_dns_record` / `delete_dns_record` commands and MCP tools only modify DNS records in DirectAdmin. For domains where MXroute is NOT the authoritative nameserver (e.g., domains using Cloudflare, Route53, GoDaddy), these operations have zero real-world effect. Users and AI agents get silently burned.

v1.1.3 added nameserver detection and warnings, but the CLI still can't actually create records on external providers unless the user manually runs `mxroute dns setup`.

## Solution

Three changes:

1. **Pluggable provider registry** — one file per provider with self-describing interface
2. **DNS router** — auto-detects provider, matches credentials, routes operations
3. **5 new providers** — Route53, Google Cloud DNS, GoDaddy, Hetzner, Vercel

After this change, `mxroute dnsrecords add` and the MCP `add_dns_record` tool "just work" regardless of where DNS lives.

---

## Component 1: Provider Registry

### File Structure

```
src/providers/
  index.ts              — register(), getProvider(), listProviders(), detectProvider()
  types.ts              — DnsProvider interface, DnsRecord, ProviderCredentials, ProviderResult
  mxroute-records.ts    — generateMxrouteRecords() (moved from registrars.ts)
  cloudflare.ts         — Cloudflare (~80 lines)
  porkbun.ts            — Porkbun (~80 lines)
  digitalocean.ts       — DigitalOcean (~80 lines)
  namecheap.ts          — Namecheap (limited)
  route53.ts            — AWS Route53 (NEW)
  google.ts             — Google Cloud DNS (NEW)
  godaddy.ts            — GoDaddy (NEW)
  hetzner.ts            — Hetzner DNS (NEW)
  vercel.ts             — Vercel DNS (NEW)
```

### DnsProvider Interface

```typescript
// src/providers/types.ts

export interface DnsRecord {
  id?: string;        // provider-specific record ID (populated by listRecords, used by deleteRecord)
  type: string;       // A, AAAA, CNAME, MX, TXT, SRV
  name: string;       // @ or subdomain
  value: string;
  priority?: number;
  ttl?: number;
}

export interface ProviderCredentials {
  [key: string]: string;  // provider-specific key/value pairs
}

export interface ProviderResult {
  success: boolean;
  message: string;
}

export interface CredentialField {
  name: string;       // key in ProviderCredentials
  label: string;      // human-readable prompt label
  secret: boolean;    // mask input
}

export interface DnsProvider {
  id: string;
  name: string;
  nsPatterns: string[];           // nameserver substrings that identify this provider
  credentialFields: CredentialField[];

  // Validate credentials have required keys before making API calls
  validateCredentials(creds: ProviderCredentials): string | null;  // returns error message or null if valid

  authenticate(creds: ProviderCredentials): Promise<boolean>;
  listZones(creds: ProviderCredentials): Promise<string[]>;
  listRecords(creds: ProviderCredentials, domain: string): Promise<DnsRecord[]>;
  createRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult>;
  deleteRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult>;
  // Optional: in-place update (avoids delete+create race condition)
  updateRecord?(creds: ProviderCredentials, domain: string, oldRecord: DnsRecord, newRecord: DnsRecord): Promise<ProviderResult>;
}
```

### Registry

```typescript
// src/providers/index.ts

const registry = new Map<string, DnsProvider>();

export function registerProvider(provider: DnsProvider): void {
  registry.set(provider.id, provider);
}

export function getProvider(id: string): DnsProvider | undefined {
  return registry.get(id);
}

export function listProviders(): DnsProvider[] {
  return Array.from(registry.values());
}

export function detectProvider(nameservers: string[]): DnsProvider | null {
  const normalized = nameservers.map(ns => ns.toLowerCase().replace(/\.$/, ''));
  for (const provider of registry.values()) {
    if (provider.nsPatterns.some(pattern =>
      normalized.some(ns => ns.includes(pattern))
    )) {
      return provider;
    }
  }
  return null;
}

// Auto-register all providers on import
import { cloudflare } from './cloudflare';
import { porkbun } from './porkbun';
// ... etc
[cloudflare, porkbun, digitalocean, namecheap, route53, google, godaddy, hetzner, vercel]
  .forEach(registerProvider);
```

### Provider nsPatterns

| Provider | nsPatterns |
|---|---|
| Cloudflare | `['cloudflare.com']` |
| Porkbun | `['porkbun.com']` |
| DigitalOcean | `['digitalocean.com']` |
| Namecheap | `['registrar-servers.com', 'namecheaphosting.com']` |
| Route53 | `['awsdns']` |
| Google Cloud DNS | `['ns-cloud']` (matches `ns-cloud-*.googledomains.com` — avoids false positive with former Google Domains/Squarespace) |
| GoDaddy | `['domaincontrol.com']` |
| Hetzner | `['hetzner.com', 'hetzner.de']` |
| Vercel | `['vercel-dns.com']` |

### Provider credentialFields

| Provider | Fields |
|---|---|
| Cloudflare | `[{ name: 'apiKey', label: 'API Token', secret: true }]` |
| Porkbun | `[{ name: 'apiKey', label: 'API Key', secret: true }, { name: 'apiSecret', label: 'Secret Key', secret: true }]` |
| DigitalOcean | `[{ name: 'apiKey', label: 'API Token', secret: true }]` |
| Namecheap | `[{ name: 'apiKey', label: 'API Key', secret: true }, { name: 'apiSecret', label: 'Username', secret: false }]` |
| Route53 | `[{ name: 'apiKey', label: 'Access Key ID', secret: false }, { name: 'apiSecret', label: 'Secret Access Key', secret: true }, { name: 'region', label: 'Region', secret: false }]` |
| Google | `[{ name: 'serviceAccountPath', label: 'Service Account JSON file path', secret: false }, { name: 'projectId', label: 'GCP Project ID', secret: false }]` |
| GoDaddy | `[{ name: 'apiKey', label: 'API Key', secret: true }, { name: 'apiSecret', label: 'API Secret', secret: true }]` |
| Hetzner | `[{ name: 'apiKey', label: 'API Token', secret: true }]` |
| Vercel | `[{ name: 'apiKey', label: 'Bearer Token', secret: true }]` |

---

## Component 2: DNS Router

### Module

```typescript
// src/utils/dns-router.ts

export interface RouteResult {
  success: boolean;
  message: string;
  provider: string;       // 'cloudflare', 'directadmin', 'none'
  method: 'registrar' | 'directadmin' | 'none';
}

export async function routeDnsAdd(domain: string, record: DnsRecord): Promise<RouteResult>;
export async function routeDnsDelete(domain: string, record: DnsRecord): Promise<RouteResult>;
export async function routeDnsList(domain: string): Promise<{ provider: string; records: DnsRecord[] }>;
```

### Routing Logic (routeDnsAdd)

```
1. resolveNs(domain) → nameservers[]
2. detectProvider(nameservers) → provider | null

3. IF provider found:
   a. Load creds from config.providers[provider.id]
   b. IF creds exist:
      - provider.createRecord(creds, domain, record)
      - Return { success, provider: provider.id, method: 'registrar' }
   c. IF no creds:
      - Return { success: false, provider: provider.id, method: 'none',
          message: `${domain} uses ${provider.name} but no credentials configured.
                    Run: mxroute dns providers setup ${provider.id}` }

4. IF no provider but MXroute is authority:
   - addDnsRecord(creds, domain, ...) via DirectAdmin
   - Return { success, provider: 'directadmin', method: 'directadmin' }

5. IF nothing matches:
   - Return { success: false, provider: 'unknown', method: 'none',
       message: `Cannot determine DNS provider for ${domain} (nameservers: ${ns.join(', ')}).
                 Add records manually at your DNS provider.` }
```

### MXroute Authority Check

Reuse existing logic: nameservers contain `mxrouting.net` or the configured server name.

---

## Component 3: Config Changes

### New Config Structure

```json
{
  "providers": {
    "cloudflare": { "apiKey": "cf_xxx" },
    "route53": { "apiKey": "AKIA...", "apiSecret": "xxx", "region": "us-east-1" },
    "porkbun": { "apiKey": "pk_xxx", "apiSecret": "sk_xxx" }
  }
}
```

### Migration

On first router call, if `config.registrar` exists but `config.providers` doesn't:
```typescript
config.providers = {
  [config.registrar.provider]: {
    apiKey: config.registrar.apiKey,
    ...(config.registrar.apiSecret ? { apiSecret: config.registrar.apiSecret } : {}),
  }
};
```

Old `config.registrar` preserved for one release cycle.

### Config Versioning

Add `configVersion: number` to `MXRouteConfig`. Current (unversioned) configs are treated as version 1. Migration sets `configVersion = 2`. This prevents re-running migration on empty `providers: {}` objects and makes future migrations safe.

### Routing Logic for `routeDnsList`

Same as `routeDnsAdd` but read-only:
1. Detect provider → if found + credentials exist → `provider.listRecords()`
2. If MXroute authority → DirectAdmin `listDnsRecords()`
3. If neither → return empty with error message

### Known Limitations

- **Split-horizon DNS** (subdomain zones delegated to a different provider) is not supported. The router resolves NS for the apex domain only.
- **Namecheap** remains detection-only — their API requires setting ALL records atomically. The router returns a helpful error message directing users to the web panel.
- **Route53 STS session tokens** (temporary credentials from IAM roles) are not supported in v1. Use long-lived IAM access keys.
- **NS caching:** `resolveNs()` results are NOT cached between calls. For batch operations across many domains, this adds latency but ensures correctness after DNS changes.

---

## Component 4: New Providers

### Route53 (AWS)

- API: `route53.amazonaws.com` (XML-based, not JSON)
- Auth: AWS Signature Version 4 (inline implementation using Node `crypto`)
  - Supports IAM access key + secret access key
  - STS session tokens NOT supported in v1 (long-lived credentials only)
  - Dedicated SigV4 signing module: `src/providers/aws-sigv4.ts` (~80 lines)
  - Tested against AWS SigV4 test vectors from AWS documentation
- Hosted Zone lookup: `GET /2013-04-01/hostedzonesbyname?dnsname={domain}`
- Record CRUD: `POST /2013-04-01/hostedzone/{id}/rrset` with `ChangeResourceRecordSets` XML body
  - For delete: requires exact current record values + TTL
  - Router calls `listRecords()` first to get current state before delete
- Rate limit: 5 requests/second per hosted zone
- **Risk mitigation:** If SigV4 proves too fiddly, Route53 will be scoped down to "detection + error message" (like current Namecheap) with a note to use `aws-sdk` or AWS CLI directly. The interface allows this graceful degradation.

### Google Cloud DNS

- API: `dns.googleapis.com/dns/v1`
- Auth: Service account JSON key file (standard for server-side)
  - Read JSON file from disk, extract `client_email` and `private_key`
  - Generate JWT, exchange for OAuth2 access token
  - `credentialFields: [{ name: 'serviceAccountPath', label: 'Path to service account JSON file', secret: false }, { name: 'projectId', label: 'GCP Project ID', secret: false }]`
- Managed Zone lookup: `GET /projects/{projectId}/managedZones?dnsName={domain}.`
- Record CRUD: `POST /projects/{projectId}/managedZones/{zone}/changes`
- Note: API key auth is NOT sufficient for write operations — service account required

### GoDaddy

- API: `api.godaddy.com/v1`
- Auth: `Authorization: sso-key {key}:{secret}`
- Simple REST CRUD on `/domains/{domain}/records/{type}/{name}`
- One of the simplest APIs to implement

### Hetzner DNS

- API: `dns.hetzner.com/api/v1`
- Auth: `Auth-API-Token: {token}`
- Zone ID lookup: `GET /zones?name={domain}`
- Record CRUD: standard REST with zone_id

### Vercel DNS

- API: `api.vercel.com`
- Auth: `Authorization: Bearer {token}`
- Records: `GET/POST/DELETE /v4/domains/{domain}/records`
- Simple token auth, straightforward CRUD

---

## Component 5: CLI & MCP Changes

### CLI Commands Updated

**`mxroute dnsrecords add [domain]`** — replaces direct DirectAdmin call + nameserver check with `routeDnsAdd()`. All the detection/warning logic moves to the router.

**`mxroute dnsrecords delete [domain]`** — same, uses `routeDnsDelete()`.

**`mxroute fix`** — replaces direct provider calls with router calls. No longer needs to load registrar config manually.

**`mxroute dns setup [domain]`** — reads `credentialFields` from detected provider dynamically instead of hardcoded prompts. Saves to `config.providers[id]`.

### New CLI Command

**`mxroute dns providers`** — list all supported providers, show credential status:
```
  Supported DNS Providers

  ✔ Cloudflare          credentials configured
  ✔ Porkbun             credentials configured
  ✖ DigitalOcean        not configured
  ✖ Namecheap           not configured (limited — no record CRUD)
  ✖ Route53 (AWS)       not configured
  ✖ Google Cloud DNS    not configured
  ✖ GoDaddy             not configured
  ✖ Hetzner DNS         not configured
  ✖ Vercel DNS          not configured

  Your domains:
  andrewadhikari.com    → Cloudflare  ✔
  faithburst.com        → Cloudflare  ✔
  voyagerslab.com       → Cloudflare  ✔
```

**`mxroute dns providers setup <id>`** — configure credentials for a specific provider. This is a NEW lightweight command (just prompts for credentials from `credentialFields` and saves to config). It does NOT replace `mxroute dns setup [domain]` which is the full workflow (detect provider + prompt creds + generate records + create records + verify). The `dns setup` command is modified to use `credentialFields` dynamically and save to `config.providers` instead of `config.registrar`.

### MCP Tool Changes

**`add_dns_record`** — calls `routeDnsAdd()`. Description updated:
> "Add a DNS record. Automatically routes to the correct DNS provider (Cloudflare, Route53, GoDaddy, etc.) based on domain nameservers. Falls back to DirectAdmin if MXroute is the DNS authority."

**`delete_dns_record`** — calls `routeDnsDelete()`. Same description update.

**New MCP tool: `list_dns_providers`** — returns supported providers with credential status and domain mappings.

---

## Component 6: Backwards Compatibility

### Deprecation of `src/utils/registrars.ts`

Old file becomes a thin re-export shim with a compatibility type:

```typescript
// src/utils/registrars.ts (deprecated)
import { ProviderCredentials } from '../providers/types';
export { getProvider, listProviders as getProviderList } from '../providers';
export { DnsRecord } from '../providers/types';
export { generateMxrouteRecords } from '../providers/mxroute-records';

// Compatibility type — preserves typed fields that fix.ts and dns-setup.ts use
export interface RegistrarConfig extends ProviderCredentials {
  provider: string;
  apiKey: string;
  apiSecret?: string;
  accountId?: string;
}
```

All imports from `registrars.ts` continue to work. Consuming code (`fix.ts`, `dns-setup.ts`) updated to use the router in the same PR, so the shim is only needed for any external consumers. File removed after one release.

### `checkNameservers()` in `dns.ts`

The hardcoded provider detection in `checkNameservers()` is replaced by a call to `detectProvider()` from the registry. The `NameserverInfo.provider` field now always matches a registered provider ID.

---

## Testing

### Unit Tests Per Provider (~9 files)

Each provider test verifies:
- `nsPatterns` match known nameserver formats
- `credentialFields` are properly defined
- `authenticate()` returns false (not throws) on invalid creds
- `createRecord()` sends correct API request shape (mocked fetch)
- `deleteRecord()` sends correct API request shape (mocked fetch)

### DNS Router Tests

- Routes to Cloudflare when NS contains "cloudflare.com"
- Routes to Route53 when NS contains "awsdns"
- Routes to DirectAdmin when MXroute is authority
- Returns error when provider detected but no credentials
- Returns error when no provider detected and not MXroute authority
- Config migration from old `registrar` to new `providers` format

### Provider Detection Accuracy Test

Data-driven test with ~20 nameserver patterns:
```typescript
['aria.ns.cloudflare.com', 'cloudflare'],
['ns1.digitalocean.com', 'digitalocean'],
['ns-123.awsdns-45.org', 'route53'],
['ns1.google.com', 'google'],
['ns1.domaincontrol.com', 'godaddy'],
['helium.ns.hetzner.de', 'hetzner'],
['ns1.vercel-dns.com', 'vercel'],
['dns1.registrar-servers.com', 'namecheap'],
['ns1.porkbun.com', 'porkbun'],
```

### Integration Tests

- `mxroute dns providers` shows all 9 providers
- `mxroute dnsrecords add --json` returns RouteResult structure
- Existing DNS check tests unchanged

---

## Implementation Order

1. **Provider types + registry** — types.ts, index.ts with detectProvider()
2. **Migrate existing 4 providers** — extract from registrars.ts into individual files
3. **DNS router** — dns-router.ts with routing logic
4. **Wire CLI + MCP** — update dnsapi.ts, mcp.ts, fix.ts to use router
5. **Add 5 new providers** — route53, google, godaddy, hetzner, vercel
6. **New commands** — `dns providers`, `dns providers setup`
7. **Config migration** — old registrar → new providers format
8. **Deprecation shim** — registrars.ts becomes re-export
9. **Tests** — provider tests, router tests, detection tests

## New Dependencies

None. Route53 signing uses Node's built-in `crypto`. All provider APIs use `node-fetch` (already a dependency).

## Files Changed/Added

| File | Action |
|---|---|
| `src/providers/types.ts` | New |
| `src/providers/index.ts` | New |
| `src/providers/mxroute-records.ts` | New (moved from registrars.ts) |
| `src/providers/cloudflare.ts` | New (extracted from registrars.ts) |
| `src/providers/porkbun.ts` | New (extracted) |
| `src/providers/digitalocean.ts` | New (extracted) |
| `src/providers/namecheap.ts` | New (extracted) |
| `src/providers/route53.ts` | New |
| `src/providers/google.ts` | New |
| `src/providers/godaddy.ts` | New |
| `src/providers/hetzner.ts` | New |
| `src/providers/vercel.ts` | New |
| `src/utils/dns-router.ts` | New |
| `src/utils/registrars.ts` | Modified (deprecation shim) |
| `src/utils/dns.ts` | Modified (checkNameservers uses detectProvider) |
| `src/commands/dnsapi.ts` | Modified (use router) |
| `src/commands/dns-setup.ts` | Modified (dynamic credential prompts) |
| `src/commands/fix.ts` | Modified (use router) |
| `src/mcp.ts` | Modified (tools use router) |
| `src/index.ts` | Modified (add dns providers command) |
| `tests/providers/*.test.ts` | New (9 provider tests) |
| `tests/dns-router.test.ts` | New |
| `tests/provider-detection.test.ts` | New |
