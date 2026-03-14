import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import {
  listDomains,
  listDomainPointers,
  addDomainPointer,
  deleteDomainPointer,
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

export async function aliasesList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Aliases: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching aliases...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const pointers = await listDomainPointers(creds, targetDomain);
    spinner.stop();

    const aliasList = Object.keys(pointers).filter((k) => k !== 'error' && k !== 'text');

    if (aliasList.length === 0) {
      console.log(theme.muted('  No aliases found.\n'));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('Alias Domain'), chalk.hex('#6C63FF')('Points To')],
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

    for (let i = 0; i < aliasList.length; i++) {
      table.push([chalk.gray(`${i + 1}`), chalk.white(aliasList[i]), chalk.cyan(targetDomain)]);
    }

    console.log(table.toString());
    console.log(theme.muted(`\n  ${aliasList.length} alias${aliasList.length !== 1 ? 'es' : ''}\n`));
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to fetch aliases'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function aliasesAdd(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Add Alias to ${targetDomain}`));

  const { aliasDomain } = await inquirer.prompt([
    {
      type: 'input',
      name: 'aliasDomain',
      message: theme.secondary('Alias domain name:'),
      validate: (input: string) => {
        if (!input.trim()) return 'Domain name is required';
        if (!input.includes('.')) return 'Enter a valid domain name (e.g. example.com)';
        return true;
      },
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Add ${aliasDomain} as an alias for ${targetDomain}?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({ text: 'Adding alias...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await addDomainPointer(creds, targetDomain, aliasDomain);

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to add alias'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      spinner.succeed(chalk.green(`Alias added: ${aliasDomain} → ${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to add alias'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function aliasesRemove(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Remove Alias from ${targetDomain}`));

  const spinner = ora({ text: 'Fetching aliases...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const pointers = await listDomainPointers(creds, targetDomain);
    spinner.stop();

    const aliasList = Object.keys(pointers).filter((k) => k !== 'error' && k !== 'text');

    if (aliasList.length === 0) {
      console.log(theme.muted('  No aliases to remove.\n'));
      return;
    }

    const { alias } = await inquirer.prompt([
      {
        type: 'list',
        name: 'alias',
        message: 'Select alias to remove:',
        choices: aliasList.map((a) => ({ name: `${a} → ${targetDomain}`, value: a })),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Delete alias ${alias}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const delSpinner = ora({ text: 'Removing alias...', spinner: 'dots12', color: 'red' }).start();
    const result = await deleteDomainPointer(creds, targetDomain, alias);

    if (result.error && result.error !== '0') {
      delSpinner.fail(chalk.red('Failed to remove alias'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      delSpinner.succeed(chalk.green(`Removed alias ${alias}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
