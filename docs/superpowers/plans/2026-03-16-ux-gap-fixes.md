# UX Gap Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all UX gaps identified in the end-user gap analysis — grouped help, onboarding guidance, command consolidation, and half-baked feature cleanup.

**Architecture:** Incremental fixes organized into 5 independent chunks. Each chunk ships a self-contained improvement. No breaking changes — commands are added/renamed with aliases preserving backwards compatibility.

**Tech Stack:** TypeScript, Commander.js, Vitest

---

## Chunk 1: Help & Discoverability

### Task 1: Grouped Help Output

The `--help` lists 62+ commands in a flat wall of text. Group them into categories with headers.

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add category headers to help output**

Commander.js supports `addHelpText('after', ...)`. Instead of restructuring all commands, add a custom help formatter that replaces the flat list with grouped output using `.configureHelp()` or by adding `program.addHelpText('beforeAll', banner)` and grouping via Commander's description field.

Simpler approach: add `.addHelpText('after', ...)` with a categorized summary and a pointer to `mxroute guide`:

```typescript
program.addHelpText('after', `
  Categories:
    Core:          setup, status, config, auth, whoami, open
    Email:         accounts, forwarders, autoresponder, catchall, filters, lists, aliases
    Mail Client:   mail inbox, mail read, mail compose, mail reply, mail search
    DNS:           dns check, dns setup, dns providers, dnsrecords
    Sending:       send, test, webhook, templates
    Security:      audit, spam, ip, reputation, ssl-check, password-audit
    Monitoring:    monitor, doctor, benchmark, cron, rate-limit
    Data:          export, import, diff, bulk, backup, migrate, usage-history
    Business:      onboard, provision, deprovision, welcome-send, credentials-export, quota-policy
    Platform:      guide, suggest, playbook, dashboard, completions, report

  Run mxroute guide to explore commands with examples.
`);
```

- [ ] **Step 2: Build and verify help output**

Run: `npx tsc && node dist/index.js --help`
Expected: Category summary appears after the command list

- [ ] **Step 3: Commit**

```
git commit -m "feat: add categorized help summary with guide pointer"
```

---

### Task 2: Onboarding Guidance in `config setup`

**Files:**
- Modify: `src/commands/config.ts`

- [ ] **Step 1: Add guidance to server hostname prompt**

Before the server hostname prompt, add:
```typescript
console.log(theme.muted('  Find your server hostname at panel.mxroute.com → DNS section'));
console.log(theme.muted('  It looks like: tuesday, fusion, arrow, etc.\n'));
```

- [ ] **Step 2: Add guidance to Login Key prompts**

Before the DA username prompt, add:
```typescript
console.log(theme.muted('  How to create a Login Key:'));
console.log(theme.muted('    1. Log into panel.mxroute.com'));
console.log(theme.muted('    2. Go to Login Keys (under Account)'));
console.log(theme.muted('    3. Create a new key'));
console.log(theme.muted('    4. Copy the key and your username\n'));
```

- [ ] **Step 3: Build and test manually**
- [ ] **Step 4: Commit**

```
git commit -m "feat: add inline guidance for server hostname and Login Key during setup"
```

---

### Task 3: `accounts list --all` Flag

**Files:**
- Modify: `src/commands/accounts.ts`
- Modify: `src/index.ts`
- Test: `tests/accounts-all.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it('accounts list should support --all flag', () => {
  const output = run('accounts --help');
  expect(output).toContain('--all');
});
```

- [ ] **Step 2: Add `--all` option to accounts list in index.ts**

```typescript
accountsCmd
  .command('list [domain]')
  .alias('ls')
  .option('-a, --all', 'List accounts across all domains')
  .description('List email accounts')
  .action(async (domain?: string, options?: any) => {
    const { accountsList } = await import('./commands/accounts');
    await accountsList(domain, options);
  });
```

- [ ] **Step 3: Implement `--all` in accountsList**

In `src/commands/accounts.ts`, when `options?.all` is true: fetch all domains, list accounts for each, display in a combined table with a "Domain" column.

- [ ] **Step 4: Build, run tests**
- [ ] **Step 5: Commit**

```
git commit -m "feat: add accounts list --all to show accounts across all domains"
```

---

### Task 4: `whoami` Points to `status`

**Files:**
- Modify: `src/commands/whoami.ts`

- [ ] **Step 1: Add footer to whoami output**

After the whoami output, add:
```typescript
console.log(theme.muted('  For full dashboard: mxroute status'));
console.log(theme.muted('  For health check:   mxroute doctor\n'));
```

- [ ] **Step 2: Commit**

```
git commit -m "feat: whoami shows pointers to status and doctor"
```

---

## Chunk 2: Command Consolidation

### Task 5: Merge `dnsrecords` Subcommands into `dns`

Currently there are TWO dns command groups:
- `dns check/records/generate/setup/watch/providers/providers-setup` — DNS health and setup
- `dnsrecords list/add/delete/dkim` — DNS record CRUD via API

Users don't understand the difference. Merge `dnsrecords` INTO `dns`:
- `dns list [domain]` — list DNS records (was `dnsrecords list`)
- `dns add [domain]` — add a record (was `dnsrecords add`)
- `dns delete [domain]` — delete a record (was `dnsrecords delete`)
- `dns dkim [domain]` — show DKIM key (was `dnsrecords dkim`)

Keep `dnsrecords` as a hidden alias for backwards compatibility.

**Files:**
- Modify: `src/index.ts`
- Test: `tests/dns-consolidated.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it('dns list should work', () => {
  const output = run('dns --help');
  expect(output).toContain('list');
  expect(output).toContain('add');
  expect(output).toContain('delete');
  expect(output).toContain('dkim');
});
```

- [ ] **Step 2: Add dnsapi commands as subcommands of dnsCmd**

In `src/index.ts`, add the 4 commands under `dnsCmd` (same handlers, just different parent):
```typescript
dnsCmd.command('list [domain]').alias('ls').description('List all DNS records')...
dnsCmd.command('add [domain]').description('Add a DNS record')...
dnsCmd.command('delete [domain]').alias('rm').description('Delete a DNS record')...
dnsCmd.command('dkim [domain]').description('Show DKIM key for domain')...
```

Keep the existing `dnsapiCmd` (`dnsrecords`) but mark it hidden: `.hideHelp()`

- [ ] **Step 3: Build, run tests**
- [ ] **Step 4: Commit**

```
git commit -m "feat: merge dnsrecords into dns — dns list, dns add, dns delete, dns dkim"
```

---

### Task 6: Clarify Health Check Commands

Four overlapping commands: `dns check`, `doctor`, `audit`, `reputation`.

**Fix:** Add descriptions that differentiate them clearly, and make `doctor` the "run everything" command.

**Files:**
- Modify: `src/index.ts` (update descriptions)
- Modify: `src/commands/doctor.ts` (add pointer to specialized commands at end)

- [ ] **Step 1: Update command descriptions in index.ts**

```typescript
// dns check — single domain DNS only
'Verify DNS records (MX, SPF, DKIM, DMARC) for one domain'

// doctor — everything
'Full health check — auth, DNS (all domains), quota, sending'

// audit — security score
'Security audit with score — DNS, catch-all, forwarding loops'

// reputation — deliverability
'Sender reputation — SPF, DKIM, DMARC, blacklists for one domain'
```

- [ ] **Step 2: Add "Related commands" footer to doctor output**

```typescript
console.log(theme.subheading('Specialized checks'));
console.log(theme.muted('    mxroute dns check <domain>    DNS only (one domain)'));
console.log(theme.muted('    mxroute audit                 Security score'));
console.log(theme.muted('    mxroute reputation <domain>   Deliverability check'));
console.log(theme.muted('    mxroute ip                    Blacklist check'));
```

- [ ] **Step 3: Commit**

```
git commit -m "fix: clarify health check command descriptions, add related commands to doctor"
```

---

### Task 7: Rename `backup` to `mail-backup`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Rename command, keep alias**

```typescript
program.command('mail-backup [domain]')
  .alias('backup')
  .description('Generate IMAP mailbox backup commands (imapsync)')
```

- [ ] **Step 2: Commit**

```
git commit -m "fix: rename backup to mail-backup (backup kept as alias)"
```

---

## Chunk 3: Half-Baked Feature Cleanup

### Task 8: Fix `schedule` Command

The `schedule` command creates scheduled autoresponders but requires a cron job (`schedule check`) to actually execute them. If the user doesn't set up cron, nothing happens.

**Fix:** When creating a schedule, offer to install a cron job automatically. Also show a clear warning.

**Files:**
- Modify: `src/commands/schedule.ts`

- [ ] **Step 1: Add warning + auto-cron offer to `scheduleCreate`**

After creating a schedule, prompt:
```typescript
console.log(theme.warning(`\n  ${theme.statusIcon('warn')} Schedules require periodic checking to activate.`));
console.log(theme.muted('  Run: mxroute cron setup   (adds schedule checking to your cron)\n'));

const { installCron } = await inquirer.prompt([{
  type: 'confirm',
  name: 'installCron',
  message: 'Install cron job to check schedules automatically?',
  default: true,
}]);

if (installCron) {
  const { cronSetup } = await import('./cron');
  await cronSetup();
}
```

- [ ] **Step 2: Commit**

```
git commit -m "fix: schedule warns about cron requirement, offers auto-install"
```

---

### Task 9: Fix `aliases sync` Description

**Files:**
- Modify: `src/commands/aliases-sync.ts` (read first to understand what it does)
- Modify: `src/index.ts`

- [ ] **Step 1: Read the command, update description to be clear**

Change from vague "Sync domain aliases across profiles/servers" to something specific based on what it actually does. If it doesn't do anything useful, remove it.

- [ ] **Step 2: Commit**

```
git commit -m "fix: clarify aliases sync description"
```

---

### Task 10: Fix `password-audit` Usability

**Files:**
- Modify: `src/commands/password-audit.ts`

- [ ] **Step 1: Add clear explanation of what this command does**

At the start of the command, explain:
```typescript
console.log(theme.heading('Password Audit'));
console.log(theme.muted('  Tests account passwords against common weak patterns.'));
console.log(theme.muted('  This works by attempting IMAP login with known weak passwords.'));
console.log(theme.muted('  Only tests accounts on your MXroute server — does not store passwords.\n'));
```

- [ ] **Step 2: Commit**

```
git commit -m "fix: add clear explanation to password-audit command"
```

---

## Chunk 4: Developer-Facing Gaps

### Task 11: Webhook API Key Authentication

**Files:**
- Modify: `src/commands/webhook.ts`

- [ ] **Step 1: Add `--api-key` option**

```typescript
// In index.ts:
.option('-k, --api-key <key>', 'Require API key for authentication')

// In webhook.ts, at the top of the request handler:
if (options.apiKey) {
  const authHeader = req.headers['authorization'] || req.headers['x-api-key'];
  if (authHeader !== `Bearer ${options.apiKey}` && authHeader !== options.apiKey) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
}
```

- [ ] **Step 2: Show auth status in startup message**

If `--api-key` is set, show:
```
Auth: Required (Bearer token or X-API-Key header)
```

- [ ] **Step 3: Write test**
- [ ] **Step 4: Commit**

```
git commit -m "feat: add --api-key option to webhook for authentication"
```

---

### Task 12: `playbook actions` Command

**Files:**
- Modify: `src/commands/playbook.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add `playbook actions` subcommand**

List all available actions from the action map:
```typescript
export function playbookActions(): void {
  console.log(theme.heading('Available Playbook Actions'));
  const actions = [
    ['accounts.create', 'Create email accounts (supports bulk via users array)'],
    ['accounts.delete', 'Delete an email account'],
    ['accounts.password', 'Change account password'],
    ['accounts.quota', 'Set account quota'],
    ['forwarders.create', 'Create forwarders (supports bulk via rules array)'],
    ['forwarders.delete', 'Delete a forwarder'],
    ['catchall.set', 'Set catch-all address'],
    ['autoresponder.create', 'Create autoresponder'],
    ['autoresponder.delete', 'Delete autoresponder'],
    ['spam.config', 'Configure SpamAssassin'],
    ['dns.check', 'Run DNS health check'],
  ];
  for (const [action, desc] of actions) {
    console.log(`  ${theme.bold(action.padEnd(24))} ${theme.muted(desc)}`);
  }
  console.log('');
}
```

- [ ] **Step 2: Wire in index.ts**

```typescript
playbookCmd.command('actions').description('List available playbook actions').action(...)
```

- [ ] **Step 3: Commit**

```
git commit -m "feat: add playbook actions command to list available actions"
```

---

## Chunk 5: Final Polish

### Task 13: Document `send` vs `mail compose`

**Files:**
- Modify: `src/commands/send.ts` (add note at top)
- Modify: `src/commands/mail.ts` (add note to compose)

- [ ] **Step 1: Add clarification to `send` command help**

In index.ts, update `send` description:
```
'Send a quick email (single recipient, no attachments — for full features use mail compose)'
```

Update `mail compose` description:
```
'Compose email with CC/BCC/attachments (full-featured — for quick sends use mxroute send)'
```

- [ ] **Step 2: Commit**

```
git commit -m "fix: clarify send vs mail compose in descriptions"
```

---

### Task 14: Full Test Suite + Push

- [ ] **Step 1: Run full CI**

```
npm run ci
```

- [ ] **Step 2: Verify key UX changes**

```bash
mxroute --help          # Should show categories at bottom
mxroute dns --help      # Should show list, add, delete, dkim alongside check, setup, etc.
mxroute accounts --help # Should show --all flag
mxroute playbook --help # Should show actions subcommand
```

- [ ] **Step 3: Commit any remaining changes and push**

```
git push
```
