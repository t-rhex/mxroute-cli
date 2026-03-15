import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { theme } from '../utils/theme';
import { getCreds } from '../utils/shared';
import {
  listDomains,
  listEmailAccounts,
  createEmailAccount,
  listForwarders,
  createForwarder,
  changeEmailQuota,
} from '../utils/directadmin';

interface ProvisionAccount {
  user: string;
  password?: string;
  quota?: number;
}

interface ProvisionForwarder {
  from: string;
  to: string;
}

interface ProvisionDomain {
  name: string;
  accounts?: ProvisionAccount[];
  forwarders?: ProvisionForwarder[];
  catchall?: string;
}

interface ProvisionManifest {
  company?: string;
  domains: ProvisionDomain[];
}

interface ProvisionResult {
  type: 'account' | 'forwarder';
  domain: string;
  resource: string;
  status: 'created' | 'skipped' | 'failed';
  password?: string;
  error?: string;
}

export function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*_+-=';
  const all = upper + lower + digits + special;

  const chars: string[] = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    special[crypto.randomInt(special.length)],
  ];

  for (let i = 4; i < 16; i++) {
    chars.push(all[crypto.randomInt(all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

function loadManifest(manifestPath: string): ProvisionManifest {
  const resolved = path.resolve(manifestPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Manifest file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf-8');
  const manifest: ProvisionManifest = JSON.parse(raw);

  if (!manifest.domains || !Array.isArray(manifest.domains) || manifest.domains.length === 0) {
    throw new Error('Manifest must contain a non-empty "domains" array');
  }

  for (const domain of manifest.domains) {
    if (!domain.name) {
      throw new Error('Each domain entry must have a "name" field');
    }
  }

  return manifest;
}

export async function provisionPlan(manifestPath: string): Promise<void> {
  const creds = getCreds();
  const manifest = loadManifest(manifestPath);

  console.log(theme.heading(`Provision Plan${manifest.company ? `: ${manifest.company}` : ''}`));

  const spinner = ora({ text: 'Analyzing existing resources...', spinner: 'dots12', color: 'cyan' }).start();

  let createCount = 0;
  let skipCount = 0;

  try {
    for (const domain of manifest.domains) {
      const existingAccounts = await listEmailAccounts(creds, domain.name);
      const existingForwarders = await listForwarders(creds, domain.name);

      spinner.stop();
      console.log(theme.subheading(`\n  ${domain.name}`));

      if (domain.accounts) {
        for (const acct of domain.accounts) {
          if (existingAccounts.includes(acct.user)) {
            console.log(chalk.yellow(`    SKIP    account  ${acct.user}@${domain.name} (already exists)`));
            skipCount++;
          } else {
            const quota = acct.quota !== undefined ? `${acct.quota}MB` : 'unlimited';
            console.log(chalk.green(`    CREATE  account  ${acct.user}@${domain.name} (${quota})`));
            createCount++;
          }
        }
      }

      if (domain.forwarders) {
        for (const fwd of domain.forwarders) {
          if (existingForwarders.includes(fwd.from)) {
            console.log(chalk.yellow(`    SKIP    fwd      ${fwd.from}@${domain.name} (already exists)`));
            skipCount++;
          } else {
            console.log(chalk.green(`    CREATE  fwd      ${fwd.from}@${domain.name} -> ${fwd.to}`));
            createCount++;
          }
        }
      }

      if (domain.catchall) {
        console.log(chalk.green(`    SET     catchall ${domain.name} -> ${domain.catchall}`));
      }

      spinner.start();
    }

    spinner.stop();
    console.log(
      theme.muted(`\n  Total: ${chalk.green(`${createCount} to create`)}, ${chalk.yellow(`${skipCount} to skip`)}\n`),
    );
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to analyze resources'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function provisionExecute(manifestPath: string): Promise<ProvisionResult[]> {
  const creds = getCreds();
  const manifest = loadManifest(manifestPath);
  const results: ProvisionResult[] = [];

  console.log(theme.heading(`Provisioning${manifest.company ? `: ${manifest.company}` : ''}`));

  const spinner = ora({ text: 'Checking existing resources...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    for (const domain of manifest.domains) {
      const existingAccounts = await listEmailAccounts(creds, domain.name);
      const existingForwarders = await listForwarders(creds, domain.name);
      spinner.stop();

      console.log(theme.subheading(`\n  ${domain.name}`));

      if (domain.accounts) {
        for (const acct of domain.accounts) {
          if (existingAccounts.includes(acct.user)) {
            console.log(chalk.yellow(`    SKIP  ${acct.user}@${domain.name}`));
            results.push({ type: 'account', domain: domain.name, resource: acct.user, status: 'skipped' });
            continue;
          }

          const password = acct.password || generatePassword();
          const acctSpinner = ora({
            text: `Creating ${acct.user}@${domain.name}...`,
            spinner: 'dots12',
            color: 'cyan',
          }).start();

          try {
            const result = await createEmailAccount(creds, domain.name, acct.user, password, acct.quota || 0);
            if (result.error && result.error !== '0') {
              acctSpinner.fail(`${acct.user}@${domain.name}: ${result.text || 'Failed'}`);
              results.push({
                type: 'account',
                domain: domain.name,
                resource: acct.user,
                status: 'failed',
                error: result.text,
              });
            } else {
              if (acct.quota && acct.quota > 0) {
                await changeEmailQuota(creds, domain.name, acct.user, acct.quota);
              }
              acctSpinner.succeed(chalk.green(`${acct.user}@${domain.name}`));
              results.push({ type: 'account', domain: domain.name, resource: acct.user, status: 'created', password });
            }
          } catch (err: any) {
            acctSpinner.fail(`${acct.user}@${domain.name}: ${err.message}`);
            results.push({
              type: 'account',
              domain: domain.name,
              resource: acct.user,
              status: 'failed',
              error: err.message,
            });
          }
        }
      }

      if (domain.forwarders) {
        for (const fwd of domain.forwarders) {
          if (existingForwarders.includes(fwd.from)) {
            console.log(chalk.yellow(`    SKIP  ${fwd.from}@${domain.name}`));
            results.push({ type: 'forwarder', domain: domain.name, resource: fwd.from, status: 'skipped' });
            continue;
          }

          const fwdSpinner = ora({
            text: `Creating forwarder ${fwd.from}@${domain.name}...`,
            spinner: 'dots12',
            color: 'cyan',
          }).start();

          try {
            const result = await createForwarder(creds, domain.name, fwd.from, fwd.to);
            if (result.error && result.error !== '0') {
              fwdSpinner.fail(`${fwd.from}@${domain.name}: ${result.text || 'Failed'}`);
              results.push({
                type: 'forwarder',
                domain: domain.name,
                resource: fwd.from,
                status: 'failed',
                error: result.text,
              });
            } else {
              fwdSpinner.succeed(chalk.green(`${fwd.from}@${domain.name} -> ${fwd.to}`));
              results.push({ type: 'forwarder', domain: domain.name, resource: fwd.from, status: 'created' });
            }
          } catch (err: any) {
            fwdSpinner.fail(`${fwd.from}@${domain.name}: ${err.message}`);
            results.push({
              type: 'forwarder',
              domain: domain.name,
              resource: fwd.from,
              status: 'failed',
              error: err.message,
            });
          }
        }
      }

      spinner.start();
    }

    spinner.stop();

    const created = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    console.log('');
    console.log(theme.success(`  ${created} created`));
    if (skipped > 0) console.log(theme.muted(`  ${skipped} skipped`));
    if (failed > 0) console.log(theme.error(`  ${failed} failed`));
    console.log('');
  } catch (err: any) {
    spinner.fail(chalk.red('Provisioning failed'));
    console.log(theme.error(`  ${err.message}\n`));
  }

  return results;
}

export async function provisionGenerate(domain?: string): Promise<void> {
  const creds = getCreds();

  let targetDomain = domain;
  if (!targetDomain) {
    const domains = await listDomains(creds);
    if (domains.length === 0) {
      console.log(theme.error('\n  No domains found.\n'));
      return;
    }
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'domain',
        message: 'Select domain to generate manifest for:',
        choices: domains,
      },
    ]);
    targetDomain = answer.domain;
  }

  console.log(theme.heading(`Generate Manifest: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching existing configuration...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain!);
    const forwarders = await listForwarders(creds, targetDomain!);
    spinner.stop();

    const manifest: ProvisionManifest = {
      domains: [
        {
          name: targetDomain!,
          accounts: accounts.map((user) => ({ user })),
          forwarders: forwarders.map((from) => ({ from, to: '' })),
        },
      ],
    };

    const filename = `provision-${targetDomain}.json`;
    const outputPath = path.resolve(filename);
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

    console.log(theme.success(`\n  Manifest written to ${filename}`));
    console.log(theme.muted(`  ${accounts.length} account(s), ${forwarders.length} forwarder(s)`));
    console.log(theme.muted(`\n  Note: forwarder destinations and passwords are not exported.`));
    console.log(theme.muted(`  Edit the file to fill in missing values before re-provisioning.\n`));
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to generate manifest'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}
