# Platform Mode Design Spec

**Date:** 2026-03-15
**Branch:** `feat/platform-mode`
**Status:** Approved (rev 2 — post-review fixes)

## Problem

The CLI has 61 command groups and 140+ subcommands but lacks the connective tissue to make them accessible, scriptable, and composable. Four pain points:

1. **Discovery** — users don't know what commands exist or how to chain them
2. **Automation** — too many interactive prompts; hard to script
3. **Visibility** — no at-a-glance view across all domains
4. **Integration** — no structured output for piping to external systems

## Solution

Five new capabilities layered on top of existing commands. No existing behavior changes.

```
┌─────────────────────────────────────────────┐
│  mxroute suggest "prompt" (command finder)   │
├─────────────────────────────────────────────┤
│  mxroute dashboard        (live TUI)         │
├─────────────────────────────────────────────┤
│  mxroute playbook run     (declarative YAML) │
├─────────────────────────────────────────────┤
│  mxroute guide <topic>    (command explorer) │
├─────────────────────────────────────────────┤
│  --json flag              (data commands)    │
├─────────────────────────────────────────────┤
│  Existing 61 commands (unchanged)            │
└─────────────────────────────────────────────┘
```

---

## Component 1: `--json` Flag (P0)

### Purpose
Structured JSON output on all data-producing commands for scripting and piping.

### Design

New shared module `src/utils/json-output.ts`:

```typescript
let jsonMode = false;
let jsonBuffer: any = {};

export function setJsonMode(enabled: boolean) {
  jsonMode = enabled;
  // Suppress ora/console.log on stdout when in JSON mode
  // Redirect spinners to stderr so stdout stays clean
  if (enabled) {
    process.env.FORCE_COLOR = '0'; // disable chalk colors in JSON
  }
}
export function isJsonMode(): boolean { return jsonMode; }

export function output(key: string, data: any) {
  if (jsonMode) {
    jsonBuffer[key] = data;
  }
}

export function outputError(code: string, message: string) {
  if (jsonMode) {
    jsonBuffer = { success: false, error: code, message };
  }
}

export function flush() {
  if (jsonMode && Object.keys(jsonBuffer).length > 0) {
    // Wrap in consistent envelope
    if (!jsonBuffer.hasOwnProperty('success')) {
      jsonBuffer = { success: true, data: jsonBuffer };
    }
    process.stdout.write(JSON.stringify(jsonBuffer, null, 2) + '\n');
    jsonBuffer = {};
  }
}
```

### Stdout/stderr separation
When `--json` is active:
- Data output goes to `stdout` only (via `flush()`)
- Spinners (ora), headings, and progress output are **suppressed entirely** in JSON mode
- Errors produce structured JSON: `{ "success": false, "error": "AUTH_REQUIRED", "message": "..." }`
- Commands that normally prompt interactively (via inquirer) **must** exit with a JSON error if required args are missing: `{ "success": false, "error": "MISSING_ARG", "message": "domain argument required" }`

### Consistent envelope
All JSON output uses the same envelope:
```json
{ "success": true, "data": { "domains": [...] } }
{ "success": false, "error": "AUTH_REQUIRED", "message": "Not authenticated" }
```

### Global option
Added in `src/index.ts` as a global Commander option:
```typescript
program.option('--json', 'Output as JSON');
program.hook('preAction', (thisCommand) => {
  if (thisCommand.opts().json) setJsonMode(true);
});
program.hook('postAction', () => flush());
```

### Migration pattern per command
Each command wraps ALL visual output (spinners, headings, tables) in JSON-mode guards:
```typescript
export async function domainsList(): Promise<void> {
  const creds = getCreds(); // throws structured JSON error in json mode
  if (!isJsonMode()) console.log(theme.heading('Domains'));
  const spinner = isJsonMode() ? null : ora({ ... }).start();

  const domains = await listDomains(creds);
  spinner?.stop();

  if (isJsonMode()) {
    output('domains', domains);
    return;
  }
  // ... existing table rendering unchanged
}
```
This is more invasive than a simple if-block — each command needs spinner guards and early returns. Budget accordingly.

### Target commands (~25)
Commands that produce data output. Interactive/wizard commands are excluded.

| Category | Commands |
|---|---|
| Account mgmt | domains list, domains info, accounts list, forwarders list, autoresponder list, catchall get, aliases list, lists list, quota show |
| DNS | dns check, dnsrecords list, dnsrecords dkim |
| Security | audit, ip, spam status, reputation |
| Monitoring | doctor, monitor, benchmark, ssl-check |
| Data | export, diff, whoami, rate-limit, usage-history |

### Migration approach
Each command adds an `if (isJsonMode()) { output('key', data); return; }` block after computing its data but before rendering. Existing rendering code is unchanged.

### Example output
```bash
$ mxroute domains list --json
{
  "domains": ["andrewadhikari.com", "faithburst.com", "voyagerslab.com"]
}

$ mxroute dns check example.com --json
{
  "domain": "example.com",
  "passed": 6,
  "total": 6,
  "checks": [
    { "type": "MX", "status": "pass", "message": "MX records configured correctly" },
    ...
  ]
}
```

### Testing
- Unit tests for json-output.ts (setJsonMode, output, flush)
- Integration tests: run CLI commands with --json, parse output, verify structure

---

## Component 2: `mxroute dashboard` (P1)

### Purpose
Live full-screen terminal UI showing all domains, DNS health, quota, blacklist status at a glance with keyboard navigation.

### Dependencies
- `ink` (React for terminal) — ~1MB, used by Gatsby/Prisma/Shopify CLIs
- `react` — peer dependency of ink
- `ink-table` — optional, for tabular data

### Layout
```
┌─ MXroute Dashboard ─────────────────────────────────────┐
│ Server: fusion.mxrouting.net    Profile: default         │
│ Disk: 3.25MB / 100GB           Accounts: 12              │
├──────────────────────────────────────────────────────────┤
│ DOMAINS            MX  SPF DKIM DMARC  Accounts  Fwds   │
│ ● andrewadhikari   ✔   ✔   ✔    ✔      3         0     │
│ ● faithburst       ✔   ✔   ✔    ✗      3         0     │
│ ● voyagerslab      ✔   ✔   ✔    ✗      5         0     │
├──────────────────────────────────────────────────────────┤
│ IP: 45.43.208.37   Blacklists: 0/10   SSL: Valid        │
├──────────────────────────────────────────────────────────┤
│ [d]omains  [a]ccounts  [n]dns  [r]efresh  [q]uit        │
└──────────────────────────────────────────────────────────┘
```

### Behavior
- Full-screen Ink app, clears terminal on start
- Fetches all data on startup via existing utility functions
- Auto-refreshes every 60 seconds
- Keyboard: `d` drills into domains, `a` accounts, `n` DNS details, `r` refresh, `q` quit, `Esc` back
- Drill-down views: domain detail (accounts, forwarders, DNS records), account detail

### File structure
```
src/commands/dashboard.tsx     — main Ink app component
src/commands/dashboard/
  DomainTable.tsx              — domain list with DNS status
  AccountView.tsx              — account detail drill-down
  StatusBar.tsx                — top bar with server/quota
  BottomBar.tsx                — keyboard shortcuts
```

### Build consideration
Ink uses JSX. Use a **separate tsconfig** to isolate JSX from the rest of the build:

`tsconfig.dashboard.json` (extends base):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "jsx": "react-jsx" },
  "include": ["src/commands/dashboard/**/*"]
}
```

The main `tsconfig.json` is unchanged. Build script compiles both:
```json
"build": "tsc && tsc -p tsconfig.dashboard.json"
```

Update `lint-staged` to include `*.tsx`:
```json
"lint-staged": { "*.{ts,tsx}": ["eslint --fix", "prettier --write"] }
```

Dashboard module is lazy-loaded via `await import()` (existing pattern) so `ink` and `react` are only loaded when `mxroute dashboard` is invoked. Users who never run the dashboard pay zero cost.

### Testing
- Unit tests for data-fetching hooks (mock directadmin responses)
- Integration test: render app, verify it starts and quits on 'q'

---

## Component 3: `mxroute playbook run` (P2)

### Purpose
Declarative YAML workflows that compose existing CLI operations. Ansible-inspired.

### Dependencies
- `js-yaml` — YAML parser (~100KB)

### Playbook format
```yaml
name: Onboard new client
vars:
  domain: "{{ domain }}"

steps:
  - name: Create standard accounts
    action: accounts.create
    args:
      domain: "{{ domain }}"
      users:
        - { user: admin, quota: 5000 }
        - { user: info, quota: 2000 }

  - name: Set catch-all to reject
    action: catchall.set
    args:
      domain: "{{ domain }}"
      value: ":fail:"

  - name: Configure DNS
    action: dns.setup
    args:
      domain: "{{ domain }}"

  - name: Verify
    action: dns.check
    args:
      domain: "{{ domain }}"
```

### CLI interface
```bash
mxroute playbook run <file> [--var key=value ...] [--dry-run]
mxroute playbook validate <file>
mxroute playbook list                  # list ~/.config/mxroute-cli/playbooks/
```

### Action mapping
Each `action` maps to an existing utility function:

```typescript
const actionMap: Record<string, Function> = {
  'accounts.create': createEmailAccount,
  'accounts.delete': deleteEmailAccount,
  'forwarders.create': createForwarder,
  'catchall.set': setCatchAll,
  'dns.check': runFullDnsCheck,
  'dns.setup': dnsSetup,
  // ... all composable operations
};
```

### Relationship to `provision` command
The existing `provision` command handles single-domain resource declaration (accounts, forwarders, quotas from a JSON manifest). Playbooks are a **superset** — multi-step workflows that can include DNS setup, verification, notifications, and cross-domain operations. Playbooks can call provision internally via the `provision.apply` action. The provision command is NOT deprecated — it remains the simpler tool for single-domain bulk setup.

### Variable substitution
Unified `{{ var }}` syntax for all variable types. Namespaced:
1. `{{ vars.domain }}` — from `--var` CLI flags or `vars:` block
2. `{{ env.HOME }}` — from environment variables
3. `{{ config.server }}` — from CLI config

Priority: CLI flags > playbook vars block > environment.

### Dry-run
`--dry-run` prints each step with resolved variables but doesn't execute.

### Error handling
- Steps execute sequentially
- On failure: print error, stop execution (default), or continue (`continue_on_error: true` per step)
- Exit code: 0 if all steps pass, 1 if any fail

### File structure
```
src/commands/playbook.ts       — CLI command (run, validate, list)
src/utils/playbook-runner.ts   — YAML parser, variable substitution, step executor
```

### Testing
- YAML parsing and variable substitution
- Dry-run output verification
- Action mapping completeness
- Error handling (missing vars, invalid action, step failure)

---

## Component 4: `mxroute guide [topic]` (P2)

### Purpose
Interactive command explorer with categories, examples, and related commands.

> **Note:** Named `guide` instead of `help` to avoid conflict with Commander.js built-in `help` command. Alias: `mxroute learn`.

### Design

Static command registry — no API calls, instant response. Auto-verified against Commander's command tree via a test that checks every registered command has a registry entry.

```typescript
// src/utils/command-registry.ts
const categories = {
  'Getting Started': {
    commands: ['setup', 'config', 'auth', 'status', 'whoami'],
    description: 'Set up and configure your MXroute CLI',
  },
  'Email Management': {
    commands: ['accounts', 'forwarders', 'autoresponder', 'catchall', 'filters', 'lists', 'aliases'],
    description: 'Manage email accounts, forwarders, and domain settings',
  },
  // ... 10 categories
};

const commandExamples: Record<string, { description: string; examples: string[]; related: string[] }> = {
  'dns check': {
    description: 'Verify MX, SPF, DKIM, and DMARC records for a domain',
    examples: [
      'mxroute dns check example.com',
      'mxroute dns check --json | jq \'.checks[]\'',
    ],
    related: ['dns setup', 'dns watch', 'audit', 'fix'],
  },
  // ... all commands
};
```

### CLI interface
```bash
mxroute guide              # interactive category picker
mxroute guide dns          # topic deep-dive
mxroute guide send         # command examples
mxroute guide security     # category overview
```

### File structure
```
src/commands/help-explorer.ts   — CLI command
src/utils/command-registry.ts   — static registry data
```

### Testing
- Category lookup by name
- Command lookup with examples
- Fuzzy matching for topics ("email" → Email Management category)

---

## Component 5: `mxroute suggest "<prompt>"` (P3)

### Purpose
Natural language → CLI command mapping. Local keyword matcher, no LLM, works offline.

> **Note:** Named `suggest` instead of `ai` to avoid setting incorrect expectations about LLM capabilities. This is a keyword matcher, not an AI. Alias: `mxroute find-command`.

### Design

Pattern-based scoring:

```typescript
const mappings = [
  { keywords: ['list', 'show', 'domains'], command: 'domains list', extract: [] },
  { keywords: ['list', 'accounts', 'email'], command: 'accounts list', extract: ['domain'] },
  { keywords: ['check', 'dns', 'verify', 'health'], command: 'dns check', extract: ['domain'] },
  { keywords: ['blacklist', 'ip', 'reputation', 'listed'], command: 'ip', extract: [] },
  { keywords: ['send', 'email', 'mail to'], command: 'send', extract: ['to', 'subject'] },
  // ... ~60 mappings
];
```

### Matching algorithm
1. Tokenize prompt into lowercase words
2. Score each mapping: count keyword matches / total keywords
3. Extract arguments (domain, email) from prompt via regex
4. If top score > 0.4: show resolved command, ask confirmation
5. If top score 0.2-0.4: show top 3 guesses, let user pick
6. If top score < 0.2: suggest `mxroute help`

### CLI interface
```bash
mxroute ai "list all accounts on voyagerslab.com"
# → mxroute accounts list voyagerslab.com
# Run this? (Y/n)
```

### File structure
```
src/commands/ai-prompt.ts   — CLI command + matcher
```

### Testing
- Test ~30 sample prompts against expected commands
- Test argument extraction (domain, email from prompt)
- Test low-confidence fallback behavior

---

## Implementation Order

1. **`--json` flag** — foundation, no new deps. Includes stdout/stderr separation, error envelope, and spinner guards.
2. **`guide` explorer** — no deps, improves discovery immediately. Creates the command registry.
3. **`suggest` command** — no deps, builds on command registry from guide.
4. **`playbook runner`** — one dep (js-yaml), composes existing functions. Can run in parallel with steps 2-3.
5. **`dashboard`** — largest scope, new deps (ink/react). Separate tsconfig. Lazy-loaded.

## New Dependencies

| Package | Size | Purpose |
|---|---|---|
| `ink` | ~1MB | React for terminal (dashboard) |
| `react` | ~300KB | Peer dep for ink |
| `js-yaml` | ~100KB | YAML parsing (playbooks) |

## Files Changed/Added

| File | Action | Purpose |
|---|---|---|
| `src/utils/json-output.ts` | New | JSON output wrapper |
| `src/utils/command-registry.ts` | New | Command categories, examples, metadata |
| `src/commands/guide.ts` | New | Interactive command explorer |
| `src/commands/suggest.ts` | New | Natural language command finder |
| `src/commands/playbook.ts` | New | Playbook CLI command |
| `src/utils/playbook-runner.ts` | New | YAML parser, variable sub, executor |
| `src/commands/dashboard.tsx` | New | Ink TUI app |
| `src/commands/dashboard/*.tsx` | New | Dashboard sub-components |
| `src/index.ts` | Modified | Add global --json, new commands |
| `~25 command files` | Modified | Add JSON output paths |
| `tsconfig.json` | Modified | Add JSX support for Ink |
| `tests/json-output.test.ts` | New | JSON wrapper tests |
| `tests/guide.test.ts` | New | Guide explorer tests |
| `tests/suggest.test.ts` | New | Suggest matcher tests |
| `tests/playbook.test.ts` | New | Playbook runner tests |
| `tests/dashboard.test.ts` | New | Dashboard render tests |

## What Does NOT Change

- All 61 existing commands and their interactive behavior
- MCP server (78+ tools)
- Config format and storage
- All existing tests
- Package binary entries (`mxroute`, `mxroute-mcp`)
