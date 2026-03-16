import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getCreds, pickDomain } from '../utils/shared';
import { listEmailAccounts, changeEmailQuota } from '../utils/directadmin';

interface PolicyRule {
  pattern: string;
  quota: number;
}

interface PolicyFile {
  rules: PolicyRule[];
}

export function matchPattern(email: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(email);
}

export async function quotaPolicyApply(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Quota Policy: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();
  const accounts = await listEmailAccounts(creds, targetDomain);
  spinner.stop();

  if (accounts.length === 0) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} No email accounts found on ${targetDomain}.\n`));
    return;
  }

  console.log(theme.muted(`  Found ${accounts.length} account(s)\n`));

  const { approach } = await inquirer.prompt([
    {
      type: 'list',
      name: 'approach',
      message: 'Policy approach:',
      choices: [
        { name: 'Apply same quota to all', value: 'uniform' },
        { name: 'Apply from policy file', value: 'file' },
      ],
    },
  ]);

  let plan: Array<{ user: string; quota: number }> = [];

  if (approach === 'uniform') {
    const { quotaMB } = await inquirer.prompt([
      {
        type: 'input',
        name: 'quotaMB',
        message: 'Quota for all accounts (MB, 0 = unlimited):',
        validate: (input: string) => (/^\d+$/.test(input) ? true : 'Enter a number'),
      },
    ]);
    const quota = Number(quotaMB);
    plan = accounts.map((user) => ({ user, quota }));
  } else {
    const { filePath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filePath',
        message: theme.secondary('Policy file path:'),
        validate: (input: string) => (fs.existsSync(input) ? true : 'File not found'),
      },
    ]);

    let policy: PolicyFile;
    try {
      policy = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      console.log(theme.error('\n  Invalid JSON in policy file.\n'));
      return;
    }

    if (!policy.rules || !Array.isArray(policy.rules)) {
      console.log(theme.error('\n  Policy file must contain a "rules" array.\n'));
      return;
    }

    for (const user of accounts) {
      const rule = policy.rules.find((r) => matchPattern(user, r.pattern));
      if (rule) {
        plan.push({ user, quota: rule.quota });
      }
    }
  }

  if (plan.length === 0) {
    console.log(theme.muted('\n  No accounts matched any rules.\n'));
    return;
  }

  console.log(theme.subheading('\n  Quota Plan:\n'));
  for (const entry of plan) {
    const quotaLabel = entry.quota === 0 ? 'unlimited' : `${entry.quota} MB`;
    console.log(theme.muted(`    ${entry.user}@${targetDomain} → ${chalk.white(quotaLabel)}`));
  }
  console.log('');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Apply quota to ${plan.length} account(s)?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  let success = 0;
  let failed = 0;

  for (let idx = 0; idx < plan.length; idx++) {
    const entry = plan[idx];
    const sp = ora({
      text: `[${idx + 1}/${plan.length}] Setting quota for ${entry.user}@${targetDomain}...`,
      spinner: 'dots12',
      color: 'cyan',
    }).start();
    try {
      const result = await changeEmailQuota(creds, targetDomain, entry.user, entry.quota);
      if (result.error && result.error !== '0') {
        sp.fail(`${entry.user}: ${result.text || 'Failed'}`);
        failed++;
      } else {
        const quotaLabel = entry.quota === 0 ? 'unlimited' : `${entry.quota} MB`;
        sp.succeed(`${entry.user}@${targetDomain} → ${quotaLabel}`);
        success++;
      }
    } catch (err: any) {
      sp.fail(`${entry.user}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(theme.success(`  ${success} updated`));
  if (failed > 0) console.log(theme.error(`  ${failed} failed`));
  console.log('');
}

export async function quotaPolicyGenerate(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Generate Quota Policy: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();
  const accounts = await listEmailAccounts(creds, targetDomain);
  spinner.stop();

  if (accounts.length === 0) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} No email accounts found on ${targetDomain}.\n`));
    return;
  }

  const policy: PolicyFile = {
    rules: accounts.map((user) => ({ pattern: user, quota: 2000 })),
  };

  const fileName = `quota-policy-${targetDomain}.json`;
  const filePath = path.resolve(process.cwd(), fileName);
  fs.writeFileSync(filePath, JSON.stringify(policy, null, 2) + '\n', 'utf-8');

  console.log(
    theme.success(`\n  ${theme.statusIcon('pass')} Policy file generated with ${accounts.length} account(s)`),
  );
  console.log(theme.muted(`  ${filePath}\n`));
}
