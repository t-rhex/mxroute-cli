import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import {
  listAutoresponders,
  getAutoresponder,
  createAutoresponder,
  modifyAutoresponder,
  deleteAutoresponder,
  listEmailAccounts,
} from '../utils/directadmin';
import { getCreds, pickDomain, tableChars } from '../utils/shared';
import { isJsonMode, output } from '../utils/json-output';
import { snapshotBeforeDelete } from '../utils/auto-backup';

export async function autoresponderList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  if (!isJsonMode()) console.log(theme.heading(`Autoresponders: ${targetDomain}`));

  const spinner = isJsonMode()
    ? null
    : ora({ text: 'Fetching autoresponders...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const autoresponders = await listAutoresponders(creds, targetDomain);
    spinner?.stop();

    if (isJsonMode()) {
      output('domain', targetDomain);
      output('autoresponders', autoresponders);
      return;
    }

    if (autoresponders.length === 0) {
      console.log(theme.muted('  No autoresponders found.'));
      console.log(theme.muted(`  Create one with: ${theme.bold(`mxroute autoresponder create ${targetDomain}`)}\n`));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('Account'), chalk.hex('#6C63FF')('CC')],
      style: { head: [], border: ['gray'] },
      chars: tableChars,
    });

    for (let i = 0; i < autoresponders.length; i++) {
      const user = autoresponders[i];
      let cc = '';
      try {
        const details = await getAutoresponder(creds, targetDomain, user);
        cc = details.cc || '';
      } catch {
        cc = chalk.gray('—');
      }
      table.push([
        chalk.gray(`${i + 1}`),
        chalk.white(`${user}@${targetDomain}`),
        cc ? chalk.cyan(cc) : chalk.gray('—'),
      ]);
    }

    console.log(table.toString());
    console.log(theme.muted(`\n  ${autoresponders.length} autoresponder${autoresponders.length !== 1 ? 's' : ''}\n`));
  } catch (err: any) {
    spinner?.fail(chalk.red('Failed to fetch autoresponders'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function autoresponderCreate(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Create Autoresponder on ${targetDomain}`));

  const acctSpinner = ora({ text: 'Fetching email accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    acctSpinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No email accounts found. Create an account first.\n'));
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

    const answers = await inquirer.prompt([
      {
        type: 'editor',
        name: 'message',
        message: theme.secondary('Autoresponder message:'),
        validate: (input: string) => (input.trim() ? true : 'Message is required'),
      },
      {
        type: 'input',
        name: 'cc',
        message: theme.secondary('CC email address (optional):'),
        validate: (input: string) => {
          if (!input.trim()) return true;
          return input.includes('@') ? true : 'Enter a valid email address (e.g., user@example.com)';
        },
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Create autoresponder for ${user}@${targetDomain}?`,
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const spinner = ora({ text: 'Creating autoresponder...', spinner: 'dots12', color: 'cyan' }).start();
    const result = await createAutoresponder(creds, targetDomain, user, answers.message, answers.cc || undefined);

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to create autoresponder'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      spinner.succeed(chalk.green(`Autoresponder created for ${user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    acctSpinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function autoresponderEdit(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Edit Autoresponder on ${targetDomain}`));

  const spinner = ora({ text: 'Fetching autoresponders...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const autoresponders = await listAutoresponders(creds, targetDomain);
    spinner.stop();

    if (autoresponders.length === 0) {
      console.log(theme.muted('  No autoresponders to edit.\n'));
      return;
    }

    const { user } = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: 'Select autoresponder to edit:',
        choices: autoresponders.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
      },
    ]);

    const detailSpinner = ora({ text: 'Fetching autoresponder details...', spinner: 'dots12', color: 'cyan' }).start();
    const details = await getAutoresponder(creds, targetDomain, user);
    detailSpinner.stop();

    const answers = await inquirer.prompt([
      {
        type: 'editor',
        name: 'message',
        message: theme.secondary('Autoresponder message:'),
        default: details.message || details.text || '',
        validate: (input: string) => (input.trim() ? true : 'Message is required'),
      },
      {
        type: 'input',
        name: 'cc',
        message: theme.secondary('CC email address (optional):'),
        default: details.cc || '',
        validate: (input: string) => {
          if (!input.trim()) return true;
          return input.includes('@') ? true : 'Enter a valid email address (e.g., user@example.com)';
        },
      },
    ]);

    const editSpinner = ora({ text: 'Updating autoresponder...', spinner: 'dots12', color: 'cyan' }).start();
    const result = await modifyAutoresponder(creds, targetDomain, user, answers.message, answers.cc || undefined);

    if (result.error && result.error !== '0') {
      editSpinner.fail(chalk.red('Failed to update autoresponder'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      editSpinner.succeed(chalk.green(`Autoresponder updated for ${user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function autoresponderDelete(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Delete Autoresponder on ${targetDomain}`));

  const spinner = ora({ text: 'Fetching autoresponders...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const autoresponders = await listAutoresponders(creds, targetDomain);
    spinner.stop();

    if (autoresponders.length === 0) {
      console.log(theme.muted('  No autoresponders to delete.\n'));
      return;
    }

    const { user } = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: 'Select autoresponder to delete:',
        choices: autoresponders.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red(`Delete autoresponder for ${user}@${targetDomain}?`),
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    // Snapshot autoresponder details before delete
    let autoresponderData: any = { user };
    try {
      const details = await getAutoresponder(creds, targetDomain, user);
      autoresponderData = { user, ...details };
    } catch {
      // best-effort
    }
    snapshotBeforeDelete({
      action: 'autoresponder.delete',
      domain: targetDomain,
      type: 'autoresponder',
      data: autoresponderData,
    });

    const delSpinner = ora({ text: 'Deleting autoresponder...', spinner: 'dots12', color: 'red' }).start();
    const result = await deleteAutoresponder(creds, targetDomain, user);

    if (result.error && result.error !== '0') {
      delSpinner.fail(chalk.red('Failed to delete autoresponder'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      delSpinner.succeed(chalk.green(`Deleted autoresponder for ${user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
