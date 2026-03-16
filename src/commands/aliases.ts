import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { listDomainPointers, addDomainPointer, deleteDomainPointer } from '../utils/directadmin';
import { getCreds, pickDomain, tableChars } from '../utils/shared';
import { isJsonMode, output } from '../utils/json-output';

export async function aliasesList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  if (!isJsonMode()) console.log(theme.heading(`Aliases: ${targetDomain}`));

  const spinner = isJsonMode() ? null : ora({ text: 'Fetching aliases...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const pointers = await listDomainPointers(creds, targetDomain);
    spinner?.stop();

    const aliasList = Object.keys(pointers).filter((k) => k !== 'error' && k !== 'text');

    if (isJsonMode()) {
      output('domain', targetDomain);
      output('aliases', aliasList);
      return;
    }

    if (aliasList.length === 0) {
      console.log(theme.muted('  No aliases found.\n'));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('Alias Domain'), chalk.hex('#6C63FF')('Points To')],
      style: { head: [], border: ['gray'] },
      chars: tableChars,
    });

    for (let i = 0; i < aliasList.length; i++) {
      table.push([chalk.gray(`${i + 1}`), chalk.white(aliasList[i]), chalk.cyan(targetDomain)]);
    }

    console.log(table.toString());
    console.log(theme.muted(`\n  ${aliasList.length} alias${aliasList.length !== 1 ? 'es' : ''}\n`));
  } catch (err: any) {
    spinner?.fail(chalk.red('Failed to fetch aliases'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
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
