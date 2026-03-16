# DNS Provider Routing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DNS record operations auto-route to the correct provider (Cloudflare, Route53, GoDaddy, etc.) based on domain nameservers, with 9 providers and a pluggable architecture.

**Architecture:** Provider registry pattern — one file per provider with self-describing interface (`nsPatterns`, `credentialFields`). DNS router detects provider via nameservers, matches per-provider credentials from config, and routes. CLI commands and MCP tools both call the router. Zero new dependencies.

**Tech Stack:** TypeScript, node-fetch (existing), Node crypto (for Route53 SigV4)

**Spec:** `docs/superpowers/specs/2026-03-16-dns-provider-routing-design.md`

---

## Chunk 1: Provider Types, Registry, and Detection

### Task 1: Provider Types Module

**Files:**
- Create: `src/providers/types.ts`
- Test: `tests/providers/types.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/providers/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Provider Types', () => {
  it('should export DnsRecord interface', async () => {
    const types = await import('../dist/providers/types');
    // Type-only module — just verify it compiles and exports exist
    expect(types).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc && npx vitest run tests/providers/types.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement types.ts**

Create `src/providers/types.ts` with all interfaces from the spec:
- `DnsRecord` (with optional `id`)
- `ProviderCredentials` (string index signature)
- `ProviderResult` (`success`, `message`)
- `CredentialField` (`name`, `label`, `secret`)
- `DnsProvider` (full interface with `id`, `name`, `nsPatterns`, `credentialFields`, `validateCredentials`, `authenticate`, `listZones`, `listRecords`, `createRecord`, `deleteRecord`, optional `updateRecord`)

- [ ] **Step 4: Build and run test**

Run: `npx tsc && npx vitest run tests/providers/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/providers/types.ts tests/providers/types.test.ts
git commit -m "feat(providers): add DnsProvider interface and type definitions"
```

---

### Task 2: Provider Registry with Detection

**Files:**
- Create: `src/providers/index.ts`
- Test: `tests/providers/registry.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/providers/registry.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('Provider Registry', () => {
  let registry: any;
  beforeAll(async () => { registry = await import('../dist/providers/index'); });

  it('registerProvider should add to registry', () => {
    expect(typeof registry.registerProvider).toBe('function');
  });

  it('getProvider should return registered provider', () => {
    expect(typeof registry.getProvider).toBe('function');
  });

  it('listProviders should return all providers', () => {
    const providers = registry.listProviders();
    expect(Array.isArray(providers)).toBe(true);
  });

  it('detectProvider should match cloudflare nameservers', () => {
    const provider = registry.detectProvider(['aria.ns.cloudflare.com', 'aurora.ns.cloudflare.com']);
    expect(provider).toBeDefined();
    expect(provider.id).toBe('cloudflare');
  });

  it('detectProvider should return null for unknown nameservers', () => {
    const provider = registry.detectProvider(['ns1.unknown-provider.com']);
    expect(provider).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement index.ts**

Create `src/providers/index.ts`:
- Internal `Map<string, DnsProvider>` registry
- `registerProvider(provider)` — adds to map
- `getProvider(id)` — lookup by id
- `listProviders()` — return all as array
- `detectProvider(nameservers[])` — iterate providers, check nsPatterns against normalized nameservers, return first match or null

NOTE: Do NOT import any provider implementations yet — just the registry functions. Providers are registered in later tasks.

- [ ] **Step 4: Build and run tests**

Run: `npx tsc && npx vitest run tests/providers/registry.test.ts`
Expected: PASS (detection test may fail without providers registered — mock a test provider inline)

- [ ] **Step 5: Commit**

```
git add src/providers/index.ts tests/providers/registry.test.ts
git commit -m "feat(providers): add provider registry with detection"
```

---

### Task 3: Provider Detection Accuracy Test

**Files:**
- Test: `tests/providers/detection.test.ts`

- [ ] **Step 1: Write data-driven detection test**

Create `tests/providers/detection.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';

const testCases: [string[], string][] = [
  [['aria.ns.cloudflare.com', 'aurora.ns.cloudflare.com'], 'cloudflare'],
  [['ns1.digitalocean.com', 'ns2.digitalocean.com'], 'digitalocean'],
  [['ns-123.awsdns-45.org', 'ns-456.awsdns-78.co.uk'], 'route53'],
  [['ns-cloud-a1.googledomains.com', 'ns-cloud-b1.googledomains.com'], 'google'],
  [['ns1.domaincontrol.com', 'ns2.domaincontrol.com'], 'godaddy'],
  [['helium.ns.hetzner.de', 'hydrogen.ns.hetzner.com'], 'hetzner'],
  [['ns1.vercel-dns.com', 'ns2.vercel-dns.com'], 'vercel'],
  [['dns1.registrar-servers.com', 'dns2.registrar-servers.com'], 'namecheap'],
  [['ns1.porkbun.com', 'ns2.porkbun.com'], 'porkbun'],
];

describe('Provider Detection Accuracy', () => {
  let registry: any;
  beforeAll(async () => { registry = await import('../dist/providers/index'); });

  for (const [nameservers, expectedId] of testCases) {
    it(`should detect ${expectedId} from ${nameservers[0]}`, () => {
      const provider = registry.detectProvider(nameservers);
      expect(provider).not.toBeNull();
      expect(provider.id).toBe(expectedId);
    });
  }

  it('should return null for unknown nameservers', () => {
    expect(registry.detectProvider(['ns1.random-host.net'])).toBeNull();
  });

  it('should handle trailing dots in nameservers', () => {
    const provider = registry.detectProvider(['aria.ns.cloudflare.com.']);
    expect(provider).not.toBeNull();
    expect(provider.id).toBe('cloudflare');
  });
});
```

NOTE: This test will only pass after all 9 providers are registered (Tasks 4-7). It serves as a regression test. Run it after Task 7.

- [ ] **Step 2: Commit test file**

```
git add tests/providers/detection.test.ts
git commit -m "test(providers): add data-driven provider detection accuracy tests"
```

---

## Chunk 2: Extract Existing 4 Providers + MXroute Records

### Task 4: Extract Cloudflare Provider

**Files:**
- Create: `src/providers/cloudflare.ts`
- Test: `tests/providers/cloudflare.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/providers/cloudflare.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('Cloudflare Provider', () => {
  let cf: any;
  beforeAll(async () => { cf = (await import('../dist/providers/cloudflare')).cloudflare; });

  it('should have correct id and name', () => {
    expect(cf.id).toBe('cloudflare');
    expect(cf.name).toBe('Cloudflare');
  });

  it('should have nsPatterns', () => {
    expect(cf.nsPatterns).toContain('cloudflare.com');
  });

  it('should have credentialFields', () => {
    expect(cf.credentialFields.length).toBeGreaterThan(0);
    expect(cf.credentialFields[0].name).toBe('apiKey');
  });

  it('validateCredentials should reject empty key', () => {
    expect(cf.validateCredentials({})).not.toBeNull();
    expect(cf.validateCredentials({ apiKey: '' })).not.toBeNull();
  });

  it('validateCredentials should accept valid key', () => {
    expect(cf.validateCredentials({ apiKey: 'some-token' })).toBeNull();
  });

  it('authenticate should return false for invalid token', async () => {
    const result = await cf.authenticate({ apiKey: 'invalid' });
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Extract Cloudflare from registrars.ts into providers/cloudflare.ts**

Read `src/utils/registrars.ts` and extract the `cloudflare` object. Rewrite it to implement the new `DnsProvider` interface from `types.ts`. Add `nsPatterns`, `credentialFields`, and `validateCredentials`. Keep all existing API logic (authenticate, listZones, listRecords, createRecord, deleteRecord).

Export as: `export const cloudflare: DnsProvider = { ... };`

- [ ] **Step 3: Register in index.ts**

Add to `src/providers/index.ts`:
```typescript
import { cloudflare } from './cloudflare';
registerProvider(cloudflare);
```

- [ ] **Step 4: Build and run tests**

Run: `npx tsc && npx vitest run tests/providers/cloudflare.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/providers/cloudflare.ts src/providers/index.ts tests/providers/cloudflare.test.ts
git commit -m "feat(providers): extract Cloudflare into standalone provider module"
```

---

### Task 5: Extract Porkbun, DigitalOcean, Namecheap

**Files:**
- Create: `src/providers/porkbun.ts`
- Create: `src/providers/digitalocean.ts`
- Create: `src/providers/namecheap.ts`
- Test: `tests/providers/existing-providers.test.ts`

Same pattern as Task 4 for each. Extract from `registrars.ts`, implement `DnsProvider` interface, add `nsPatterns`/`credentialFields`/`validateCredentials`, register in `index.ts`.

For **Namecheap**: `createRecord` and `deleteRecord` return `{ success: false, message: 'Namecheap requires setting ALL records atomically. Use their web panel or switch DNS to Cloudflare.' }`.

- [ ] **Step 1: Write tests for all 3 providers** (nsPatterns, credentialFields, validateCredentials)
- [ ] **Step 2: Extract each provider into its own file**
- [ ] **Step 3: Register all in index.ts**
- [ ] **Step 4: Build and run tests**
- [ ] **Step 5: Commit**

```
git add src/providers/porkbun.ts src/providers/digitalocean.ts src/providers/namecheap.ts src/providers/index.ts tests/providers/existing-providers.test.ts
git commit -m "feat(providers): extract Porkbun, DigitalOcean, Namecheap into standalone modules"
```

---

### Task 6: Extract generateMxrouteRecords + Deprecation Shim

**Files:**
- Create: `src/providers/mxroute-records.ts`
- Modify: `src/utils/registrars.ts` (replace with deprecation shim)

- [ ] **Step 1: Move `generateMxrouteRecords()` from registrars.ts to providers/mxroute-records.ts**

- [ ] **Step 2: Replace registrars.ts with deprecation shim**

```typescript
// src/utils/registrars.ts (deprecated shim)
import { ProviderCredentials } from '../providers/types';
export { getProvider, listProviders as getProviderList } from '../providers';
export { DnsRecord } from '../providers/types';
export { generateMxrouteRecords } from '../providers/mxroute-records';

export interface RegistrarConfig extends ProviderCredentials {
  provider: string;
  apiKey: string;
  apiSecret?: string;
  accountId?: string;
}
```

- [ ] **Step 3: Build — verify all existing imports still compile**

Run: `npx tsc`
Expected: 0 errors (shim re-exports everything existing code needs)

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```
git add src/providers/mxroute-records.ts src/utils/registrars.ts
git commit -m "refactor(providers): deprecate registrars.ts, extract mxroute-records"
```

---

## Chunk 3: DNS Router

### Task 7: DNS Router Implementation

**Files:**
- Create: `src/utils/dns-router.ts`
- Test: `tests/dns-router.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/dns-router.test.ts` testing:
- `routeDnsAdd` returns `RouteResult` structure
- Routes to correct provider when detected + credentials exist
- Returns error when provider detected but no credentials
- Returns error when unknown provider
- Falls back to DirectAdmin when MXroute is authority
- Config migration from old `registrar` to new `providers` format

- [ ] **Step 2: Implement dns-router.ts**

```typescript
// src/utils/dns-router.ts
import { Resolver } from 'dns';
import { promisify } from 'util';
import { getConfig, setConfig } from './config';
import { detectProvider } from '../providers';
import { DnsRecord, ProviderCredentials } from '../providers/types';
import { addDnsRecord, deleteDnsRecord, listDnsRecords as daListDnsRecords } from './directadmin';

const resolver = new Resolver();
const resolveNs = promisify(resolver.resolveNs.bind(resolver));

export interface RouteResult {
  success: boolean;
  message: string;
  provider: string;
  method: 'registrar' | 'directadmin' | 'none';
}

function migrateConfig(): void { /* migrate config.registrar → config.providers if needed */ }
function getProviderCreds(providerId: string): ProviderCredentials | null { /* load from config.providers */ }
function isMxrouteAuthority(nameservers: string[], server: string): boolean { /* check for mxrouting.net */ }

export async function routeDnsAdd(domain: string, record: DnsRecord): Promise<RouteResult> { /* routing logic */ }
export async function routeDnsDelete(domain: string, record: DnsRecord): Promise<RouteResult> { /* routing logic */ }
export async function routeDnsList(domain: string): Promise<{ provider: string; records: DnsRecord[] }> { /* routing logic */ }
```

Implement the full routing logic from the spec:
1. resolveNs → detectProvider → load creds → provider.createRecord
2. Fallback to DirectAdmin if MXroute is authority
3. Error if no provider and not MXroute

- [ ] **Step 3: Build and run tests**

Run: `npx tsc && npx vitest run tests/dns-router.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add src/utils/dns-router.ts tests/dns-router.test.ts
git commit -m "feat(router): add DNS router with auto-detection, credential matching, and fallback"
```

---

### Task 8: Wire CLI and MCP to Use Router

**Files:**
- Modify: `src/commands/dnsapi.ts`
- Modify: `src/commands/fix.ts`
- Modify: `src/mcp.ts`
- Modify: `src/utils/dns.ts` (checkNameservers uses detectProvider)

- [ ] **Step 1: Update dnsapi.ts — replace DirectAdmin + nameserver check with router calls**

In `dnsapiAdd()`: remove the manual nameserver check block. Replace `addDnsRecord(creds, ...)` with `routeDnsAdd(domain, record)`. Display `RouteResult`.

In `dnsapiDelete()`: same — replace with `routeDnsDelete()`.

- [ ] **Step 2: Update fix.ts — replace direct provider calls with router**

Remove the manual `registrarConfig` loading and `getProvider()` call. Replace each `provider.createRecord(...)` with `routeDnsAdd(domain, record)`.

- [ ] **Step 3: Update mcp.ts — simplify add_dns_record and delete_dns_record**

Replace the nameserver check + DirectAdmin call with `routeDnsAdd()` / `routeDnsDelete()`. Return `RouteResult` directly. Update tool descriptions.

- [ ] **Step 4: Update dns.ts — checkNameservers uses detectProvider**

Replace the hardcoded provider detection in `checkNameservers()` with a call to `detectProvider()` from `../providers`. The `provider` field now returns the provider `id` from the registry.

- [ ] **Step 5: Build, lint, run all tests**

Run: `npx tsc && npx eslint src/ --quiet && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```
git add src/commands/dnsapi.ts src/commands/fix.ts src/mcp.ts src/utils/dns.ts
git commit -m "refactor: wire dnsapi, fix, and MCP tools to use DNS router"
```

---

## Chunk 4: New Providers

### Task 9: GoDaddy Provider

**Files:**
- Create: `src/providers/godaddy.ts`
- Test: `tests/providers/godaddy.test.ts`

- [ ] **Step 1: Write failing tests** (id, name, nsPatterns, credentialFields, validateCredentials, authenticate returns false for invalid)
- [ ] **Step 2: Implement godaddy.ts**

GoDaddy API:
- Auth: `Authorization: sso-key {apiKey}:{apiSecret}`
- List: `GET https://api.godaddy.com/v1/domains/{domain}/records`
- Create: `PATCH https://api.godaddy.com/v1/domains/{domain}/records` (appends records)
- Delete: `DELETE https://api.godaddy.com/v1/domains/{domain}/records/{type}/{name}`
- `nsPatterns: ['domaincontrol.com']`
- `credentialFields: [{ name: 'apiKey', label: 'API Key', secret: true }, { name: 'apiSecret', label: 'API Secret', secret: true }]`

- [ ] **Step 3: Register in index.ts**
- [ ] **Step 4: Build and run tests**
- [ ] **Step 5: Commit**

```
git add src/providers/godaddy.ts tests/providers/godaddy.test.ts src/providers/index.ts
git commit -m "feat(providers): add GoDaddy DNS provider"
```

---

### Task 10: Hetzner Provider

**Files:**
- Create: `src/providers/hetzner.ts`
- Test: `tests/providers/hetzner.test.ts`

Same pattern. Hetzner API:
- Auth: `Auth-API-Token: {apiKey}`
- Zone lookup: `GET https://dns.hetzner.com/api/v1/zones?name={domain}`
- List: `GET https://dns.hetzner.com/api/v1/records?zone_id={zoneId}`
- Create: `POST https://dns.hetzner.com/api/v1/records` with `{zone_id, type, name, value, ttl}`
- Delete: `DELETE https://dns.hetzner.com/api/v1/records/{recordId}`
- `nsPatterns: ['hetzner.com', 'hetzner.de']`

- [ ] **Step 1-5: Same pattern as Task 9**

```
git commit -m "feat(providers): add Hetzner DNS provider"
```

---

### Task 11: Vercel Provider

**Files:**
- Create: `src/providers/vercel.ts`
- Test: `tests/providers/vercel.test.ts`

Vercel API:
- Auth: `Authorization: Bearer {apiKey}`
- List: `GET https://api.vercel.com/v4/domains/{domain}/records`
- Create: `POST https://api.vercel.com/v2/domains/{domain}/records`
- Delete: `DELETE https://api.vercel.com/v2/domains/{domain}/records/{recordId}`
- `nsPatterns: ['vercel-dns.com']`

- [ ] **Step 1-5: Same pattern**

```
git commit -m "feat(providers): add Vercel DNS provider"
```

---

### Task 12: Route53 Provider (with SigV4)

**Files:**
- Create: `src/providers/aws-sigv4.ts`
- Create: `src/providers/route53.ts`
- Test: `tests/providers/route53.test.ts`
- Test: `tests/providers/aws-sigv4.test.ts`

- [ ] **Step 1: Write SigV4 signing tests**

Test against known AWS SigV4 test vectors (from AWS documentation). The signing module must produce correct `Authorization` headers for known inputs.

- [ ] **Step 2: Implement aws-sigv4.ts**

Minimal AWS Signature V4 signing (~80 lines):
- `signRequest(method, url, headers, body, credentials, region, service)` → signed headers
- Uses Node `crypto` for HMAC-SHA256
- Handles canonical request construction, string to sign, signing key derivation

- [ ] **Step 3: Write Route53 provider tests**

- [ ] **Step 4: Implement route53.ts**

Route53 API (XML-based):
- Auth: SigV4 via `aws-sigv4.ts`
- Zone lookup: `GET /2013-04-01/hostedzonesbyname?dnsname={domain}`
- List: `GET /2013-04-01/hostedzone/{id}/rrset`
- Create/Delete: `POST /2013-04-01/hostedzone/{id}/rrset` with `ChangeResourceRecordSets` XML
- Parse XML responses (simple regex — no XML parser dependency)
- **If SigV4 is too complex:** fall back to detection-only (like Namecheap)

- [ ] **Step 5: Register and commit**

```
git commit -m "feat(providers): add Route53 with inline SigV4 signing"
```

---

### Task 13: Google Cloud DNS Provider

**Files:**
- Create: `src/providers/google.ts`
- Test: `tests/providers/google.test.ts`

Google Cloud DNS API:
- Auth: Service account JSON → JWT → OAuth2 token exchange
- Zone lookup: `GET https://dns.googleapis.com/dns/v1/projects/{project}/managedZones?dnsName={domain}.`
- Create: `POST https://dns.googleapis.com/dns/v1/projects/{project}/managedZones/{zone}/changes`
- JWT generation uses Node `crypto` for RSA-SHA256 signing
- `nsPatterns: ['ns-cloud']`

- [ ] **Step 1-5: Same pattern**

```
git commit -m "feat(providers): add Google Cloud DNS provider"
```

---

## Chunk 5: New Commands, Config Migration, and Integration

### Task 14: `dns providers` and `dns providers setup` Commands

**Files:**
- Create: `src/commands/dns-providers.ts`
- Modify: `src/index.ts`
- Test: `tests/dns-providers.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe('DNS Providers Command', () => {
  it('should show dns providers in help', () => {
    expect(run('dns --help')).toContain('providers');
  });

  it('dns providers should list all 9 providers', () => {
    const output = run('dns providers');
    expect(output).toContain('Cloudflare');
    expect(output).toContain('Route53');
    expect(output).toContain('GoDaddy');
    expect(output).toContain('Hetzner');
    expect(output).toContain('Vercel');
  });
});
```

- [ ] **Step 2: Implement dns-providers.ts**

Two functions:
- `dnsProvidersCommand()` — list all providers with credential status + domain mapping
- `dnsProvidersSetup(providerId)` — prompt for credentials using `provider.credentialFields`, test with `authenticate()`, save to `config.providers[id]`

- [ ] **Step 3: Add to index.ts**

Add as subcommands under `dnsCmd`:
```typescript
dnsCmd.command('providers').description('List supported DNS providers and status')
dnsCmd.command('providers-setup <provider>').description('Configure credentials for a DNS provider')
```

- [ ] **Step 4: Build and run tests**
- [ ] **Step 5: Commit**

```
git commit -m "feat(dns): add dns providers list and setup commands"
```

---

### Task 15: Config Migration

**Files:**
- Modify: `src/utils/dns-router.ts` (add migration logic)
- Modify: `src/utils/config.ts` (add configVersion to MXRouteConfig)
- Test: `tests/config-migration.test.ts`

- [ ] **Step 1: Write failing tests**

Test that old `{ registrar: { provider: 'cloudflare', apiKey: 'xxx' } }` migrates to `{ providers: { cloudflare: { apiKey: 'xxx' } }, configVersion: 2 }`.

- [ ] **Step 2: Add configVersion to MXRouteConfig interface**

- [ ] **Step 3: Implement migration in dns-router.ts**

Called on first `routeDnsAdd`/`routeDnsDelete`/`routeDnsList`.

- [ ] **Step 4: Build and run tests**
- [ ] **Step 5: Commit**

```
git commit -m "feat(config): add config versioning and registrar-to-providers migration"
```

---

### Task 16: Update MCP Tool `list_dns_providers`

**Files:**
- Modify: `src/mcp.ts`

- [ ] **Step 1: Add new MCP tool**

```typescript
server.tool('list_dns_providers', 'List supported DNS providers with credential status', {}, async () => {
  const providers = listProviders();
  const config = getConfig();
  const providerCreds = (config as any).providers || {};
  const result = providers.map(p => ({
    id: p.id,
    name: p.name,
    configured: !!providerCreds[p.id],
    credentialFields: p.credentialFields.map(f => f.label),
  }));
  return { content: [{ type: 'text', text: JSON.stringify({ providers: result }, null, 2) }] };
});
```

- [ ] **Step 2: Build and run MCP test**
- [ ] **Step 3: Commit**

```
git commit -m "feat(mcp): add list_dns_providers tool"
```

---

### Task 17: Run Detection Tests + Full CI

**Files:** None new — run all tests

- [ ] **Step 1: Run provider detection accuracy tests**

Run: `npx vitest run tests/providers/detection.test.ts`
Expected: All 9 providers detected correctly

- [ ] **Step 2: Run full CI pipeline**

Run: `npm run ci`
Expected: lint 0 errors, typecheck passes, build succeeds, all tests pass

- [ ] **Step 3: Update README**

Add DNS Provider Routing section documenting the 9 providers, `dns providers` command, and auto-routing behavior.

- [ ] **Step 4: Commit and push**

```
git add -A
git commit -m "docs: update README with DNS provider routing and 9 supported providers"
git push -u origin feat/dns-provider-routing
```

- [ ] **Step 5: Create PR**

```
gh pr create --title "feat: DNS provider routing — 9 providers, auto-detection, smart routing" --body "..."
```
