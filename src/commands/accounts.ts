import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { listEmailAccounts, createEmailAccount, deleteEmailAccount, changeEmailPassword } from '../utils/directadmin';
import { getCreds, pickDomain, tableChars } from '../utils/shared';

export async function accountsList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Email Accounts: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    spinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No email accounts found.\n'));
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
    spinner.fail(chalk.red('Failed to fetch accounts'));
    console.log(theme.error(`  ${err.message}\n`));
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
      message: theme.secondary('Password:'),
      mask: '•',
      validate: (input: string) => (input.length >= 8 ? true : 'Password must be at least 8 characters'),
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
      validate: (input: string) => (!isNaN(Number(input)) ? true : 'Must be a number'),
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
      console.log(theme.error(`  ${result.text || result.details || JSON.stringify(result)}\n`));
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
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
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
        message: theme.secondary('New password:'),
        mask: '•',
        validate: (input: string) => (input.length >= 8 ? true : 'Password must be at least 8 characters'),
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
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      pwSpinner.succeed(chalk.green(`Password updated for ${user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
