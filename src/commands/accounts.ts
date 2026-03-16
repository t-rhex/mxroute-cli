import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { listEmailAccounts, createEmailAccount, deleteEmailAccount, changeEmailPassword } from '../utils/directadmin';
import { getCreds, pickDomain, tableChars } from '../utils/shared';
import { isJsonMode, output } from '../utils/json-output';

export async function accountsList(domain?: string, options?: { all?: boolean }): Promise<void> {
  const creds = getCreds();

  if (options?.all) {
    // List across all domains
    if (!isJsonMode()) console.log(theme.heading('All Email Accounts'));
    const spinner = isJsonMode()
      ? null
      : ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const { listDomains } = await import('../utils/directadmin');
      const domains = await listDomains(creds);
      spinner?.stop();

      const allAccounts: { domain: string; email: string }[] = [];
      for (const d of domains) {
        const accounts = await listEmailAccounts(creds, d);
        allAccounts.push(...accounts.map((a) => ({ domain: d, email: `${a}@${d}` })));
      }

      if (isJsonMode()) {
        output('accounts', allAccounts);
        return;
      }

      // Render table
      const table = new Table({
        head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('Domain'), chalk.hex('#6C63FF')('Email')],
        style: { head: [], border: ['gray'] },
        chars: tableChars,
      });
      allAccounts.forEach((a, i) => {
        table.push([chalk.gray(`${i + 1}`), chalk.white(a.domain), chalk.white(a.email)]);
      });
      console.log(table.toString());
      console.log(
        theme.muted(
          `\n  ${allAccounts.length} account${allAccounts.length !== 1 ? 's' : ''} across ${domains.length} domain${domains.length !== 1 ? 's' : ''}\n`,
        ),
      );
    } catch (err: any) {
      spinner?.fail('Failed to fetch accounts');
      if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
    }
    return;
  }

  const targetDomain = await pickDomain(creds, domain);

  if (!targetDomain) return;

  if (!isJsonMode()) console.log(theme.heading(`Email Accounts: ${targetDomain}`));

  const spinner = isJsonMode() ? null : ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    spinner?.stop();

    if (isJsonMode()) {
      output('domain', targetDomain);
      output('accounts', accounts);
      return;
    }

    if (accounts.length === 0) {
      console.log(theme.muted('  No email accounts found.'));
      console.log(theme.muted(`  Create one with: ${theme.bold(`mxroute accounts create ${targetDomain}`)}\n`));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('Email Address')],
      style: { head: [], border: ['gray'] },
      chars: tableChars,
    });

    for (let i = 0; i < accounts.length; i++) {
      table.push([chalk.gray(`${i + 1}`), chalk.white(`${accounts[i]}@${targetDomain}`)]);
    }

    console.log(table.toString());
    console.log(theme.muted(`\n  ${accounts.length} account${accounts.length !== 1 ? 's' : ''}\n`));
  } catch (err: any) {
    spinner?.fail(chalk.red('Failed to fetch accounts'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function accountsCreate(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Create Email Account on ${targetDomain}`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'user',
      message: theme.secondary(`Username (before @${targetDomain}):`),
      validate: (input: string) => {
        if (!input.trim()) return 'Username is required';
        if (input.includes('@')) return 'Enter just the username, not the full email';
        if (!/^[a-zA-Z0-9._-]+$/.test(input)) return 'Invalid characters in username';
        return true;
      },
    },
    {
      type: 'password',
      name: 'password',
      message: theme.secondary('Password (min 8 chars, mix of upper/lower/numbers recommended):'),
      mask: '•',
      validate: (input: string) => {
        if (input.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(input) || !/[a-z]/.test(input) || !/[0-9]/.test(input)) {
          return 'Weak password — use a mix of uppercase, lowercase, and numbers';
        }
        return true;
      },
    },
    {
      type: 'password',
      name: 'confirmPassword',
      message: theme.secondary('Confirm password:'),
      mask: '•',
      validate: (input: string, answers: any) => (input === answers.password ? true : 'Passwords do not match'),
    },
    {
      type: 'input',
      name: 'quota',
      message: theme.secondary('Quota in MB (0 = unlimited):'),
      default: '0',
      validate: (input: string) => {
        const num = Number(input);
        if (isNaN(num)) return 'Must be a number';
        if (num < 0) return 'Quota cannot be negative';
        return true;
      },
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Create ${answers.user}@${targetDomain}?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({ text: 'Creating account...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await createEmailAccount(creds, targetDomain, answers.user, answers.password, Number(answers.quota));

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to create account'));
      const msg = result.text || result.details || 'Unknown error — check credentials and try again';
      console.log(theme.error(`  ${msg}\n`));
    } else {
      spinner.succeed(chalk.green(`Created ${answers.user}@${targetDomain}`));
      console.log('');
      console.log(
        theme.box(
          [
            theme.keyValue('Email', `${answers.user}@${targetDomain}`, 0),
            theme.keyValue('Quota', answers.quota === '0' ? 'Unlimited' : `${answers.quota} MB`, 0),
          ].join('\n'),
          'Account Created',
        ),
      );
      console.log('');
      console.log(theme.subheading('Next steps:'));
      console.log(theme.muted(`    mxroute share ${answers.user}@${targetDomain}    Generate setup instructions`));
      console.log(theme.muted(`    mxroute forwarders create ${targetDomain}    Create a forwarder`));
      console.log(theme.muted(`    mxroute autoresponder create ${targetDomain}  Set up vacation reply`));
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to create account'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function accountsDelete(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Delete Email Account on ${targetDomain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    spinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No accounts to delete.\n'));
      return;
    }

    const { user } = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: 'Select account to delete:',
        choices: accounts.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red(`Permanently delete ${user}@${targetDomain}? This cannot be undone.`),
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const delSpinner = ora({ text: 'Deleting account...', spinner: 'dots12', color: 'red' }).start();
    const result = await deleteEmailAccount(creds, targetDomain, user);

    if (result.error && result.error !== '0') {
      delSpinner.fail(chalk.red('Failed to delete account'));
      const msg = result.text || result.details || 'Unknown error — check credentials and try again';
      console.log(theme.error(`  ${msg}\n`));
    } else {
      delSpinner.succeed(chalk.green(`Deleted ${user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function accountsPasswd(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Change Password on ${targetDomain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    spinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No accounts found.\n'));
      return;
    }

    const { user } = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: 'Select account:',
        choices: accounts.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
      },
    ]);

    const { password } = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: theme.secondary('New password (min 8 chars, mix of upper/lower/numbers recommended):'),
        mask: '•',
        validate: (input: string) => {
          if (input.length < 8) return 'Password must be at least 8 characters';
          if (!/[A-Z]/.test(input) || !/[a-z]/.test(input) || !/[0-9]/.test(input)) {
            return 'Weak password — use a mix of uppercase, lowercase, and numbers';
          }
          return true;
        },
      },
    ]);

    await inquirer.prompt([
      {
        type: 'password',
        name: 'confirmPassword',
        message: theme.secondary('Confirm new password:'),
        mask: '•',
        validate: (input: string) => (input === password ? true : 'Passwords do not match'),
      },
    ]);

    const pwSpinner = ora({ text: 'Updating password...', spinner: 'dots12', color: 'cyan' }).start();
    const result = await changeEmailPassword(creds, targetDomain, user, password);

    if (result.error && result.error !== '0') {
      pwSpinner.fail(chalk.red('Failed to change password'));
      const msg = result.text || result.details || 'Unknown error — check credentials and try again';
      console.log(theme.error(`  ${msg}\n`));
    } else {
      pwSpinner.succeed(chalk.green(`Password updated for ${user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
