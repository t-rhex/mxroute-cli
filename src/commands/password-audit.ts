import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as crypto from 'crypto';
import { theme } from '../utils/theme';
import { listDomains, listEmailAccounts, changeEmailPassword } from '../utils/directadmin';
import { getCreds } from '../utils/shared';

const COMMON_PASSWORDS = [
  'password',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'monkey',
  'master',
  'dragon',
  'login',
  'admin',
  'letmein',
  'welcome',
  'password1',
  'Password1',
  'test',
  'test123',
  'changeme',
  'default',
  'email',
  'mail',
];

const WEAK_PATTERNS = [
  /^[a-z]+$/, // all lowercase
  /^[0-9]+$/, // all digits
  /^[A-Z]+$/, // all uppercase
  /^(.)\1+$/, // repeated character
  /^(012|123|234|345|456|567|678|789)/, // sequential digits
  /^(abc|bcd|cde|def|efg)/i, // sequential letters
];

function auditPassword(password: string): string[] {
  const issues: string[] = [];

  if (password.length < 8) issues.push('Too short (< 8 characters)');
  if (password.length < 12) issues.push('Could be longer (< 12 characters)');
  if (!/[A-Z]/.test(password)) issues.push('No uppercase letters');
  if (!/[a-z]/.test(password)) issues.push('No lowercase letters');
  if (!/[0-9]/.test(password)) issues.push('No numbers');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('No special characters');

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.includes(lower)) issues.push('Common/dictionary password');

  for (const pattern of WEAK_PATTERNS) {
    if (pattern.test(password)) {
      issues.push('Uses weak pattern');
      break;
    }
  }

  return issues;
}

export async function passwordAuditCommand(): Promise<void> {
  const creds = getCreds();

  console.log(theme.heading('Password Audit'));
  console.log(theme.muted('  This checks password policies across all accounts.\n'));
  console.log(
    theme.warning(`  ${theme.statusIcon('warn')} Note: The CLI cannot retrieve existing passwords from the server.`),
  );
  console.log(theme.muted('  This tool helps you test passwords and identify accounts to review.\n'));

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Audit mode:',
      choices: [
        { name: 'Test a specific password', value: 'test' },
        { name: 'List all accounts for review', value: 'list' },
        { name: 'Bulk password reset (generate strong passwords)', value: 'reset' },
      ],
    },
  ]);

  if (mode === 'test') {
    const { password } = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: theme.secondary('Enter password to test:'),
        mask: '\u2022',
        validate: (input: string) => (input ? true : 'Password is required'),
      },
    ]);

    const issues = auditPassword(password);

    console.log('');
    if (issues.length === 0) {
      console.log(theme.success(`  ${theme.statusIcon('pass')} Password looks strong!`));
    } else {
      console.log(
        theme.warning(`  ${theme.statusIcon('warn')} ${issues.length} issue${issues.length === 1 ? '' : 's'} found:`),
      );
      for (const issue of issues) {
        console.log(theme.muted(`    - ${issue}`));
      }
    }

    // Strength meter
    const strength = Math.max(0, 100 - issues.length * 15);
    const barWidth = 20;
    const filled = Math.round((strength / 100) * barWidth);
    const empty = barWidth - filled;

    let barColor = theme.success;
    if (strength < 40) barColor = theme.error;
    else if (strength < 70) barColor = theme.warning;

    const bar = barColor('='.repeat(filled)) + chalk.hex('#7C8DB0')('-'.repeat(empty));
    console.log(`\n  Strength: [${bar}] ${strength}%\n`);
    return;
  }

  if (mode === 'list') {
    const spinner = ora({ text: 'Fetching all accounts...', spinner: 'dots12', color: 'cyan' }).start();

    try {
      const domains = await listDomains(creds);
      const allAccounts: { email: string; domain: string; user: string }[] = [];

      for (const domain of domains) {
        try {
          const accounts = await listEmailAccounts(creds, domain);
          for (const user of accounts) {
            allAccounts.push({ email: `${user}@${domain}`, domain, user });
          }
        } catch {
          /* skip */
        }
      }

      spinner.stop();

      if (allAccounts.length === 0) {
        console.log(theme.muted('  No accounts found.\n'));
        return;
      }

      console.log(
        theme.muted(
          `  Found ${allAccounts.length} account${allAccounts.length === 1 ? '' : 's'} across ${domains.length} domain${domains.length === 1 ? '' : 's'}:\n`,
        ),
      );

      // Group by domain
      const grouped: Record<string, string[]> = {};
      for (const a of allAccounts) {
        if (!grouped[a.domain]) grouped[a.domain] = [];
        grouped[a.domain].push(a.user);
      }

      for (const [domain, users] of Object.entries(grouped)) {
        console.log(theme.subheading(domain));
        for (const user of users) {
          console.log(`      ${theme.statusIcon('info')} ${user}@${domain}`);
        }
        console.log('');
      }

      console.log(theme.muted('  To change a password: mxroute accounts passwd'));
      console.log(theme.muted('  Recommended: 16+ characters with mixed case, numbers, and symbols.\n'));
    } catch (err: any) {
      spinner.fail(chalk.red('Failed to fetch accounts'));
      console.log(theme.error(`  ${err.message}\n`));
    }
    return;
  }

  if (mode === 'reset') {
    console.log(
      theme.warning(`\n  ${theme.statusIcon('warn')} This will generate new strong passwords for selected accounts.`),
    );
    console.log(theme.muted('  The old passwords will be permanently replaced.\n'));

    const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

    try {
      const domains = await listDomains(creds);
      const allAccounts: { email: string; domain: string; user: string }[] = [];

      for (const domain of domains) {
        try {
          const accounts = await listEmailAccounts(creds, domain);
          for (const user of accounts) {
            allAccounts.push({ email: `${user}@${domain}`, domain, user });
          }
        } catch {
          /* skip */
        }
      }

      spinner.stop();

      if (allAccounts.length === 0) {
        console.log(theme.muted('  No accounts found.\n'));
        return;
      }

      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: 'Select accounts to reset:',
          choices: allAccounts.map((a) => ({ name: a.email, value: a })),
        },
      ]);

      if (selected.length === 0) {
        console.log(theme.muted('\n  No accounts selected.\n'));
        return;
      }

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Reset passwords for ${selected.length} account${selected.length === 1 ? '' : 's'}?`,
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(theme.muted('\n  Cancelled.\n'));
        return;
      }

      const results: { email: string; password: string }[] = [];

      for (const account of selected) {
        const newPassword = generateStrongPassword();
        const resetSpinner = ora({
          text: `Resetting ${account.email}...`,
          spinner: 'dots12',
          color: 'cyan',
        }).start();

        try {
          const result = await changeEmailPassword(creds, account.domain, account.user, newPassword);
          if (result.error && result.error !== '0') {
            resetSpinner.fail(chalk.red(`${account.email}: ${result.text || 'Failed'}`));
          } else {
            resetSpinner.succeed(chalk.green(account.email));
            results.push({ email: account.email, password: newPassword });
          }
        } catch (err: any) {
          resetSpinner.fail(chalk.red(`${account.email}: ${err.message}`));
        }
      }

      if (results.length > 0) {
        console.log('');
        const credLines = results.map((r) => theme.keyValue(r.email, r.password, 0));
        console.log(theme.box(credLines.join('\n'), 'New Passwords'));
        console.log(
          theme.warning(`\n  ${theme.statusIcon('warn')} Save these passwords now \u2014 they won't be shown again!\n`),
        );
      }
    } catch (err: any) {
      spinner.fail(chalk.red('Failed'));
      console.log(theme.error(`  ${err.message}\n`));
    }
  }
}

function generateStrongPassword(length: number = 20): string {
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

  for (let i = chars.length; i < length; i++) {
    chars.push(all[crypto.randomInt(all.length)]);
  }

  // Fisher-Yates shuffle with crypto.randomInt
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
