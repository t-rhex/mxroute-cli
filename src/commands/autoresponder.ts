import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import {
  listDomains,
  listAutoresponders,
  getAutoresponder,
  createAutoresponder,
  modifyAutoresponder,
  deleteAutoresponder,
  listEmailAccounts,
  DACredentials,
} from '../utils/directadmin';

function getCreds(): DACredentials {
  const config = getConfig();
  if (!config.daUsername || !config.daLoginKey) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} Not authenticated. Run ${theme.bold('mxroute auth login')} first.\n`,
      ),
    );
    process.exit(1);
  }
  return { server: config.server, username: config.daUsername, loginKey: config.daLoginKey };
}

async function pickDomain(creds: DACredentials, domain?: string): Promise<string> {
  if (domain) return domain;

  const config = getConfig();
  if (config.domain) return config.domain;

  const spinner = ora({ text: 'Fetching domains...', spinner: 'dots12', color: 'cyan' }).start();
  const domains = await listDomains(creds);
  spinner.stop();

  if (domains.length === 0) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} No domains found.\n`));
    process.exit(1);
  }

  if (domains.length === 1) return domains[0];

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: 'Select domain:',
      choices: domains,
    },
  ]);

  return selected;
}

export async function autoresponderList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Autoresponders: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching autoresponders...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const autoresponders = await listAutoresponders(creds, targetDomain);
    spinner.stop();

    if (autoresponders.length === 0) {
      console.log(theme.muted('  No autoresponders found.\n'));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('Account'), chalk.hex('#6C63FF')('CC')],
      style: { head: [], border: ['gray'] },
      chars: {
        top: '─',
        'top-mid': '┬',
        'top-left': '  ┌',
        'top-right': '┐',
        bottom: '─',
        'bottom-mid': '┴',
        'bottom-left': '  └',
        'bottom-right': '┘',
        left: '  │',
        'left-mid': '  ├',
        mid: '─',
        'mid-mid': '┼',
        right: '│',
        'right-mid': '┤',
        middle: '│',
      },
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
    spinner.fail(chalk.red('Failed to fetch autoresponders'));
    console.log(theme.error(`  ${err.message}\n`));
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
          return input.includes('@') ? true : 'Enter a valid email address';
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
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
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
          return input.includes('@') ? true : 'Enter a valid email address';
        },
      },
    ]);

    const editSpinner = ora({ text: 'Updating autoresponder...', spinner: 'dots12', color: 'cyan' }).start();
    const result = await modifyAutoresponder(creds, targetDomain, user, answers.message, answers.cc || undefined);

    if (result.error && result.error !== '0') {
      editSpinner.fail(chalk.red('Failed to update autoresponder'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
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

    const delSpinner = ora({ text: 'Deleting autoresponder...', spinner: 'dots12', color: 'red' }).start();
    const result = await deleteAutoresponder(creds, targetDomain, user);

    if (result.error && result.error !== '0') {
      delSpinner.fail(chalk.red('Failed to delete autoresponder'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      delSpinner.succeed(chalk.green(`Deleted autoresponder for ${user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
