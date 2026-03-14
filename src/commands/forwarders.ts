import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import {
  listDomains,
  listForwarders,
  getForwarderDestination,
  createForwarder,
  deleteForwarder,
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

export async function forwardersList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Forwarders: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching forwarders...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const forwarders = await listForwarders(creds, targetDomain);
    spinner.stop();

    if (forwarders.length === 0) {
      console.log(theme.muted('  No forwarders found.\n'));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('From'), chalk.hex('#6C63FF')('To')],
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

    for (let i = 0; i < forwarders.length; i++) {
      const fwd = forwarders[i];
      let dest = '';
      try {
        dest = await getForwarderDestination(creds, targetDomain, fwd);
      } catch {
        dest = chalk.gray('—');
      }
      table.push([chalk.gray(`${i + 1}`), chalk.white(`${fwd}@${targetDomain}`), chalk.cyan(dest)]);
    }

    console.log(table.toString());
    console.log(theme.muted(`\n  ${forwarders.length} forwarder${forwarders.length !== 1 ? 's' : ''}\n`));
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to fetch forwarders'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function forwardersCreate(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Create Forwarder on ${targetDomain}`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'user',
      message: theme.secondary(`Username (before @${targetDomain}):`),
      validate: (input: string) => {
        if (!input.trim()) return 'Username is required';
        if (input.includes('@')) return 'Enter just the username part';
        return true;
      },
    },
    {
      type: 'input',
      name: 'destination',
      message: theme.secondary('Forward to (email address):'),
      validate: (input: string) => (input.includes('@') ? true : 'Enter a valid email address'),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Forward ${answers.user}@${targetDomain} to ${answers.destination}?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({ text: 'Creating forwarder...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await createForwarder(creds, targetDomain, answers.user, answers.destination);

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to create forwarder'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      spinner.succeed(chalk.green(`Forwarder created: ${answers.user}@${targetDomain} → ${answers.destination}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to create forwarder'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function forwardersDelete(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Delete Forwarder on ${targetDomain}`));

  const spinner = ora({ text: 'Fetching forwarders...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const forwarders = await listForwarders(creds, targetDomain);
    spinner.stop();

    if (forwarders.length === 0) {
      console.log(theme.muted('  No forwarders to delete.\n'));
      return;
    }

    const { user } = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: 'Select forwarder to delete:',
        choices: forwarders.map((f) => ({ name: `${f}@${targetDomain}`, value: f })),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Delete forwarder ${user}@${targetDomain}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const delSpinner = ora({ text: 'Deleting forwarder...', spinner: 'dots12', color: 'red' }).start();
    const result = await deleteForwarder(creds, targetDomain, user);

    if (result.error && result.error !== '0') {
      delSpinner.fail(chalk.red('Failed to delete forwarder'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      delSpinner.succeed(chalk.green(`Deleted forwarder ${user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
