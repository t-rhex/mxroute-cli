# Platform Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scriptability (`--json`), discoverability (`guide`, `suggest`), automation (`playbook`), and visibility (`dashboard`) to the 61-command CLI.

**Architecture:** Five additive layers on top of existing commands. `--json` is the foundation. Guide and suggest use a shared command registry. Playbook composes existing utility functions. Dashboard is a standalone Ink (React) TUI app, lazy-loaded and built with a separate tsconfig.

**Tech Stack:** TypeScript, Commander.js (existing), Ink + React (dashboard), js-yaml (playbooks), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-15-platform-mode-design.md`

---

## Chunk 1: JSON Flag Foundation

### Task 1: JSON Output Module

**Files:**
- Create: `src/utils/json-output.ts`
- Test: `tests/json-output.test.ts`

- [ ] **Step 1: Write failing tests for json-output module**

Create `tests/json-output.test.ts` testing: `isJsonMode()` defaults false, `setJsonMode(true)` enables it, `output()` buffers data, `outputError()` sets error envelope, `flush()` is no-op when buffer empty, `resetBuffer()` clears state.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsc && npx vitest run tests/json-output.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement json-output.ts**

Create `src/utils/json-output.ts` with functions: `setJsonMode`, `isJsonMode`, `output`, `outputError`, `flush`, `resetBuffer`. The `flush` function wraps non-error buffers in `{ success: true, data: {...} }` envelope and writes to stdout. Guards against empty buffer.

- [ ] **Step 4: Build and run tests**

Run: `npx tsc && npx vitest run tests/json-output.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/utils/json-output.ts tests/json-output.test.ts
git commit -m "feat(json): add json-output module with buffer, envelope, and error support"
```

---

### Task 2: Wire --json as Global Commander Option

**Files:**
- Modify: `src/index.ts` (add global option + hooks)
- Modify: `src/utils/shared.ts` (JSON-safe getCreds error)
- Test: `tests/json-flag.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `tests/json-flag.test.ts` that runs CLI commands with `--json` flag and verifies output is valid JSON with `success` field. Test `domains list --json`, `whoami --json`, `dns check <domain> --json`, `quota show --json`.

Note: Tests use `execSync` with hardcoded CLI path — this is safe (no user input in commands).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/json-flag.test.ts`
Expected: FAIL — --json not recognized

- [ ] **Step 3: Add global --json option to index.ts**

Import `setJsonMode` and `flush` from `./utils/json-output`. Add `program.option('--json', 'Output as JSON')`. Add `preAction` hook to set JSON mode. Add `postAction` hook to flush.

- [ ] **Step 4: Update getCreds in shared.ts for JSON-safe errors**

Import `isJsonMode` and `outputError`. When auth fails and `isJsonMode()` is true, call `outputError('AUTH_REQUIRED', ...)` instead of `console.log` + `process.exit(1)`.

- [ ] **Step 5: Build and verify**

Run: `npx tsc`
Expected: Compiles. Tests still fail (commands don't output JSON yet)

- [ ] **Step 6: Commit wiring**

```
git add src/index.ts src/utils/shared.ts tests/json-flag.test.ts
git commit -m "feat(json): wire --json as global Commander option with pre/post action hooks"
```

---

### Task 3: Migrate First 5 Commands to JSON Output

**Files:**
- Modify: `src/commands/domains.ts`
- Modify: `src/commands/whoami.ts`
- Modify: `src/commands/dns.ts` (dnsCheck only)
- Modify: `src/commands/accounts.ts` (accountsList only)
- Modify: `src/commands/catchall.ts` (catchallGet only)

Migration pattern per command:
1. Import `isJsonMode` and `output` from `../utils/json-output`
2. Guard spinner: `const spinner = isJsonMode() ? null : ora({...}).start()`
3. Guard headings: `if (!isJsonMode()) console.log(theme.heading(...))`
4. After data computation: `if (isJsonMode()) { output('key', data); return; }`
5. Guard interactive prompts: if JSON mode and required arg missing, call `outputError('MISSING_ARG', ...)` and return

- [ ] **Step 1: Migrate domains.ts (domainsList + domainsInfo)**
- [ ] **Step 2: Migrate whoami.ts**
- [ ] **Step 3: Migrate dns.ts (dnsCheck) — guard the inquirer prompt for missing domain**
- [ ] **Step 4: Migrate accounts.ts (accountsList)**
- [ ] **Step 5: Migrate catchall.ts (catchallGet)**
- [ ] **Step 6: Build and run integration tests**

Run: `npx tsc && npx vitest run tests/json-flag.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```
git add src/commands/domains.ts src/commands/whoami.ts src/commands/dns.ts src/commands/accounts.ts src/commands/catchall.ts
git commit -m "feat(json): migrate domains, whoami, dns check, accounts list, catchall get to --json"
```

---

### Task 4: Migrate Remaining ~20 Commands to JSON Output

**Files:** ~20 command files from the spec's target list.

Same migration pattern. Group into 3 batches:

- [ ] **Step 1: Account management batch** — forwarders list, autoresponder list, aliases list, lists list, quota show, domains info

- [ ] **Step 2: DNS/security batch** — dnsapi list, dnsapi dkim, audit, ip, spam status, reputation

- [ ] **Step 3: Monitoring/data batch** — doctor, monitor, benchmark, ssl-check, export, diff, rate-limit, usage-history

- [ ] **Step 4: Build, lint, run all tests**

Run: `npx tsc && npx eslint src/ tests/ --quiet && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```
git add src/commands/*.ts
git commit -m "feat(json): migrate remaining 20 commands to --json output"
```

---

## Chunk 2: Command Guide and Suggest

### Task 5: Command Registry

**Files:**
- Create: `src/utils/command-registry.ts`
- Test: `tests/command-registry.test.ts`

- [ ] **Step 1: Write failing tests**

Test: at least 8 categories exist, key commands have examples, `findCategory('dns')` returns DNS category, fuzzy match `findCategory('email')` works, `findCommand('dns check')` returns examples and related commands.

- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Implement command-registry.ts**

10 categories covering all 61 commands. Each command entry has: description, examples (2-3 real commands), related commands. Export: `categories`, `commandExamples`, `findCategory(query)`, `findCommand(query)`, `getAllCommands()`.

- [ ] **Step 4: Build and run tests**
- [ ] **Step 5: Commit**

```
git add src/utils/command-registry.ts tests/command-registry.test.ts
git commit -m "feat(guide): add command registry with categories, examples, and fuzzy matching"
```

---

### Task 6: Guide Command

**Files:**
- Create: `src/commands/guide.ts`
- Modify: `src/index.ts`
- Test: `tests/guide.test.ts`

- [ ] **Step 1: Write failing tests** — guide in help, `guide dns` shows dns check + examples, `guide send` shows send, unknown topic handled
- [ ] **Step 2: Implement guide.ts** — no args = interactive category picker via inquirer, with topic = findCategory or findCommand, render with theme
- [ ] **Step 3: Add to index.ts** — `program.command('guide [topic]').alias('learn')`
- [ ] **Step 4: Build and run tests**
- [ ] **Step 5: Commit**

```
git add src/commands/guide.ts src/index.ts tests/guide.test.ts
git commit -m "feat(guide): add interactive command explorer with categories and examples"
```

---

### Task 7: Suggest Command

**Files:**
- Create: `src/commands/suggest.ts`
- Modify: `src/index.ts`
- Test: `tests/suggest.test.ts`

- [ ] **Step 1: Write failing tests** — suggest in help, "list domains" matches `domains list`, "check dns" matches `dns check`, "blacklisted" matches `ip`, no-match shows guide suggestion
- [ ] **Step 2: Implement suggest.ts** — ~60 keyword mappings, scoring algorithm, argument extraction (domain/email via regex), confidence thresholds (>0.4 = show, 0.2-0.4 = top 3, <0.2 = suggest guide)
- [ ] **Step 3: Add to index.ts** — `program.command('suggest <prompt>').alias('find-command')`
- [ ] **Step 4: Build and run tests**
- [ ] **Step 5: Commit**

```
git add src/commands/suggest.ts src/index.ts tests/suggest.test.ts
git commit -m "feat(suggest): add natural language command finder with keyword matching"
```

---

## Chunk 3: Playbook Runner

### Task 8: Playbook Runner Core

**Files:**
- Create: `src/utils/playbook-runner.ts`
- Test: `tests/playbook-runner.test.ts`

- [ ] **Step 1: Install js-yaml**

```
npm install js-yaml && npm install -D @types/js-yaml
```

- [ ] **Step 2: Write failing tests**

Test: `parsePlaybook()` parses valid YAML, `substituteVars()` replaces `{{ vars.domain }}` and `{{ env.HOME }}`, `validatePlaybook()` catches missing name/steps/action, dry-run returns step descriptions without executing, missing var throws error.

- [ ] **Step 3: Implement playbook-runner.ts**

Functions: `parsePlaybook(yamlContent)`, `substituteVars(template, context)`, `validatePlaybook(playbook)`, `executePlaybook(playbook, actionMap, options)`. Action map uses `Record<string, (...args: any[]) => Promise<any>>` with typed wrappers around existing DirectAdmin/DNS functions.

- [ ] **Step 4: Build and run tests**
- [ ] **Step 5: Commit**

```
git add src/utils/playbook-runner.ts tests/playbook-runner.test.ts package.json package-lock.json
git commit -m "feat(playbook): add YAML playbook runner with variable substitution and dry-run"
```

---

### Task 9: Playbook CLI Command

**Files:**
- Create: `src/commands/playbook.ts`
- Modify: `src/index.ts`
- Test: `tests/playbook-cli.test.ts`

- [ ] **Step 1: Write failing tests** — playbook in help, `playbook validate` on a test YAML, `playbook run --dry-run` shows steps
- [ ] **Step 2: Implement playbook.ts** — subcommands: `run` (parse, substitute, execute), `validate` (parse, check errors), `list` (scan playbooks dir)
- [ ] **Step 3: Add to index.ts** — `playbookCmd` with run/validate/list subcommands
- [ ] **Step 4: Build and run tests**
- [ ] **Step 5: Commit**

```
git add src/commands/playbook.ts src/index.ts tests/playbook-cli.test.ts
git commit -m "feat(playbook): add playbook CLI with run, validate, and list subcommands"
```

---

## Chunk 4: Dashboard TUI

### Task 10: Dashboard Build Setup

**Files:**
- Create: `tsconfig.dashboard.json`
- Modify: `package.json` (deps + build script + lint-staged)
- Modify: `eslint.config.mjs` (tsx support)

- [ ] **Step 1: Install dependencies**

```
npm install ink@4 react@18
npm install -D @types/react
```

Note: Use ink v4 (stable, CJS-compatible) not v5 (ESM-only).

- [ ] **Step 2: Create tsconfig.dashboard.json**

Extends base tsconfig, adds `"jsx": "react-jsx"`, includes only `src/commands/dashboard*`.

- [ ] **Step 3: Update package.json**

Build: `"build": "tsc && tsc -p tsconfig.dashboard.json"`. Lint-staged: `"*.{ts,tsx}"`.

- [ ] **Step 4: Verify build works**

Run: `npm run build`
Expected: Compiles with no errors

- [ ] **Step 5: Commit**

```
git add tsconfig.dashboard.json package.json package-lock.json eslint.config.mjs
git commit -m "feat(dashboard): add Ink/React deps and separate tsconfig for JSX"
```

---

### Task 11: Dashboard Components

**Files:**
- Create: `src/commands/dashboard.tsx`
- Create: `src/commands/dashboard/StatusBar.tsx`
- Create: `src/commands/dashboard/DomainTable.tsx`
- Create: `src/commands/dashboard/BottomBar.tsx`
- Modify: `src/index.ts`
- Test: `tests/dashboard.test.ts`

- [ ] **Step 1: Write failing test** — dashboard in help output
- [ ] **Step 2: Implement StatusBar** — server name, profile, disk usage, account count
- [ ] **Step 3: Implement DomainTable** — domain list with MX/SPF/DKIM/DMARC status columns, account and forwarder counts
- [ ] **Step 4: Implement BottomBar** — keyboard shortcut hints
- [ ] **Step 5: Implement main dashboard.tsx** — full-screen Ink app, useInput for keyboard, useState for view state, useEffect for data fetching and 60s auto-refresh
- [ ] **Step 6: Add to index.ts** — `program.command('dashboard').alias('dash')`
- [ ] **Step 7: Build and test**

Run: `npm run build && npx vitest run tests/dashboard.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```
git add src/commands/dashboard.tsx src/commands/dashboard/ src/index.ts tests/dashboard.test.ts
git commit -m "feat(dashboard): add live TUI dashboard with domain/DNS/quota overview"
```

---

## Chunk 5: Final Integration

### Task 12: Full CI and PR

**Files:**
- Modify: `README.md`
- Run: full test suite + lint

- [ ] **Step 1: Run full CI pipeline**

```
npm run ci
```
Expected: lint 0 errors, typecheck passes, build succeeds, all tests pass

- [ ] **Step 2: Update README**

Add sections for `--json` flag, `guide`, `suggest`, `playbook`, and `dashboard` to the command reference.

- [ ] **Step 3: Commit and push branch**

```
git add -A
git commit -m "docs: update README with platform mode features (json, guide, suggest, playbook, dashboard)"
git push -u origin feat/platform-mode
```

- [ ] **Step 4: Create PR**

```
gh pr create --title "feat: platform mode — json, guide, suggest, playbook, dashboard" --body "$(cat <<'EOF'
## Summary
- --json flag on 25+ commands for scriptability
- mxroute guide — interactive command explorer
- mxroute suggest — natural language command finder
- mxroute playbook — declarative YAML workflow runner
- mxroute dashboard — live full-screen TUI

## Test plan
- [ ] All existing tests still pass
- [ ] JSON output verified on domains, dns, accounts, quota, audit
- [ ] Guide shows categories and command examples
- [ ] Suggest matches common phrases to correct commands
- [ ] Playbook dry-run produces expected output
- [ ] Dashboard starts and quits with 'q'

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
