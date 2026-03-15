import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { listForwarders, getForwarderDestination, createForwarder, deleteForwarder } from '../utils/directadmin';
import { getCreds, pickDomain, tableChars, validateEmail } from '../utils/shared';

export async function forwardersList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Forwarders: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching forwarders...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const forwarders = await listForwarders(creds, targetDomain);
    spinner.stop();

    if (forwarders.length === 0) {
      console.log(theme.muted('  No forwarders found.'));
      console.log(theme.muted(`  Create one with: ${theme.bold(`mxroute forwarders create ${targetDomain}`)}\n`));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('From'), chalk.hex('#6C63FF')('To')],
      style: { head: [], border: ['gray'] },
      chars: tableChars,
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
      validate: validateEmail,
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
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      spinner.succeed(chalk.green(`Forwarder created: ${answers.user}@${targetDomain} → ${answers.destination}`));
      console.log(theme.muted(`\n  View all forwarders: ${theme.bold(`mxroute forwarders list ${targetDomain}`)}\n`));
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
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      delSpinner.succeed(chalk.green(`Deleted forwarder ${user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
