import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { theme } from '../utils/theme';
import { parsePlaybook, validatePlaybook, executePlaybook } from '../utils/playbook-runner';
import { getCreds } from '../utils/shared';
import {
  createEmailAccount,
  deleteEmailAccount,
  changeEmailPassword,
  changeEmailQuota,
  createForwarder,
  deleteForwarder,
  setCatchAll,
  createAutoresponder,
  deleteAutoresponder,
  setSpamConfig,
} from '../utils/directadmin';
import { runFullDnsCheck } from '../utils/dns';

// Action map linking playbook actions to existing functions
function getActionMap(): Record<string, (...args: any[]) => Promise<any>> {
  const creds = getCreds();
  return {
    'accounts.create': async (args: any) => {
      if (args.users && Array.isArray(args.users)) {
        for (const u of args.users) {
          await createEmailAccount(creds, args.domain, u.user, u.password || generatePassword(), u.quota || 0);
        }
      } else {
        await createEmailAccount(creds, args.domain, args.user, args.password || generatePassword(), args.quota || 0);
      }
    },
    'accounts.delete': async (args: any) => deleteEmailAccount(creds, args.domain, args.user),
    'accounts.password': async (args: any) => changeEmailPassword(creds, args.domain, args.user, args.password),
    'accounts.quota': async (args: any) => changeEmailQuota(creds, args.domain, args.user, args.quota),
    'forwarders.create': async (args: any) => {
      if (args.rules && Array.isArray(args.rules)) {
        for (const r of args.rules) {
          await createForwarder(creds, args.domain, r.from, r.to);
        }
      } else {
        await createForwarder(creds, args.domain, args.from, args.to);
      }
    },
    'forwarders.delete': async (args: any) => deleteForwarder(creds, args.domain, args.user),
    'catchall.set': async (args: any) => setCatchAll(creds, args.domain, args.value),
    'autoresponder.create': async (args: any) => createAutoresponder(creds, args.domain, args.user, args.text, args.cc),
    'autoresponder.delete': async (args: any) => deleteAutoresponder(creds, args.domain, args.user),
    'spam.config': async (args: any) => setSpamConfig(creds, args.domain, args),
    'dns.check': async (args: any) => runFullDnsCheck(args.domain, creds.server),
  };
}

function generatePassword(length = 16): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let password = '';

  const crypto = require('crypto');
  const array = new Uint8Array(length);
  crypto.randomFillSync(array);
  for (let i = 0; i < length; i++) password += chars[array[i] % chars.length];
  return password;
}

const PLAYBOOKS_DIR = path.join(os.homedir(), '.config', 'mxroute-cli', 'playbooks');

export async function playbookRun(file: string, options: { var?: string[]; dryRun?: boolean }): Promise<void> {
  if (!fs.existsSync(file)) {
    console.log(theme.error(`\n  File not found: ${file}\n`));
    return;
  }

  const content = fs.readFileSync(file, 'utf-8');
  const playbook = parsePlaybook(content);

  const errors = validatePlaybook(playbook);
  if (errors.length > 0) {
    console.log(theme.error('\n  Validation errors:'));
    errors.forEach((e) => console.log(theme.error(`    - ${e}`)));
    console.log('');
    return;
  }

  // Parse --var flags
  const vars: Record<string, string> = {};
  if (options.var) {
    for (const v of options.var) {
      const [key, ...rest] = v.split('=');
      vars[key] = rest.join('=');
    }
  }

  console.log(theme.heading(`Playbook: ${playbook.name}`));
  console.log(theme.muted(`  ${playbook.steps.length} step${playbook.steps.length !== 1 ? 's' : ''}`));
  if (options.dryRun) console.log(theme.warning('  DRY RUN — no changes will be made'));
  console.log('');

  const actionMap = options.dryRun ? {} : getActionMap();
  // For dry run, provide stub actions
  if (options.dryRun) {
    for (const step of playbook.steps) {
      actionMap[step.action] = async () => {};
    }
  }

  const results = await executePlaybook(playbook, actionMap, { dryRun: options.dryRun, vars });

  for (const r of results) {
    const icon = r.skipped ? theme.statusIcon('info') : r.success ? theme.statusIcon('pass') : theme.statusIcon('fail');
    const status = r.skipped ? theme.muted('skip') : r.success ? theme.success('done') : theme.error('fail');
    console.log(`  ${icon} ${theme.bold(r.step.padEnd(30))} ${status}`);
    if (!r.success && !r.skipped) console.log(theme.muted(`     ${r.message}`));
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success && !r.skipped).length;
  console.log('');
  if (failed === 0) {
    console.log(theme.success(`  ${theme.statusIcon('pass')} All ${passed} steps completed\n`));
  } else {
    console.log(theme.error(`  ${passed} passed, ${failed} failed\n`));
  }
}

export function playbookValidate(file: string): void {
  if (!fs.existsSync(file)) {
    console.log(theme.error(`\n  File not found: ${file}\n`));
    return;
  }
  try {
    const playbook = parsePlaybook(fs.readFileSync(file, 'utf-8'));
    const errors = validatePlaybook(playbook);
    if (errors.length === 0) {
      console.log(
        theme.success(
          `\n  ${theme.statusIcon('pass')} Playbook "${playbook.name}" is valid (${playbook.steps.length} steps)\n`,
        ),
      );
    } else {
      console.log(theme.error('\n  Validation errors:'));
      errors.forEach((e) => console.log(theme.error(`    - ${e}`)));
      console.log('');
    }
  } catch (err: any) {
    console.log(theme.error(`\n  Parse error: ${err.message}\n`));
  }
}

export function playbookActions(): void {
  console.log(theme.heading('Available Playbook Actions'));
  console.log(theme.muted('  Use these in the "action" field of playbook steps.\n'));

  const actions: [string, string][] = [
    ['accounts.create', 'Create email account(s) — supports bulk via users[] array'],
    ['accounts.delete', 'Delete an email account'],
    ['accounts.password', 'Change account password'],
    ['accounts.quota', 'Set account storage quota'],
    ['forwarders.create', 'Create forwarder(s) — supports bulk via rules[] array'],
    ['forwarders.delete', 'Delete a forwarder'],
    ['catchall.set', 'Set catch-all address (:fail:, :blackhole:, or email)'],
    ['autoresponder.create', 'Create an autoresponder/vacation message'],
    ['autoresponder.delete', 'Delete an autoresponder'],
    ['spam.config', 'Configure SpamAssassin settings'],
    ['dns.check', 'Run DNS health check for a domain'],
  ];

  for (const [action, desc] of actions) {
    console.log(`  ${theme.bold(action.padEnd(24))} ${theme.muted(desc)}`);
  }

  console.log('');
  console.log(theme.subheading('Example step'));
  console.log(theme.muted('    - name: Create admin account'));
  console.log(theme.muted('      action: accounts.create'));
  console.log(theme.muted('      args:'));
  console.log(theme.muted('        domain: "{{ vars.domain }}"'));
  console.log(theme.muted('        user: admin'));
  console.log(theme.muted('        password: "{{ vars.password }}"'));
  console.log('');
}

export function playbookList(): void {
  console.log(theme.heading('Saved Playbooks'));
  if (!fs.existsSync(PLAYBOOKS_DIR)) {
    console.log(theme.muted(`  No playbooks found at ${PLAYBOOKS_DIR}\n`));
    return;
  }
  const files = fs.readdirSync(PLAYBOOKS_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  if (files.length === 0) {
    console.log(theme.muted('  No playbooks found.\n'));
    return;
  }
  for (const f of files) {
    try {
      const pb = parsePlaybook(fs.readFileSync(path.join(PLAYBOOKS_DIR, f), 'utf-8'));
      console.log(theme.keyValue(f, `${pb.name} (${pb.steps.length} steps)`));
    } catch {
      console.log(theme.keyValue(f, theme.error('invalid YAML')));
    }
  }
  console.log('');
}
