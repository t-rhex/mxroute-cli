import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { listEmailAccounts, listEmailFilters, createEmailFilter, deleteEmailFilter } from '../utils/directadmin';
import { getCreds, pickDomain, tableChars } from '../utils/shared';

export async function filtersList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Email Filters: ${targetDomain}`));

  const acctSpinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    acctSpinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No email accounts found.\n'));
      return;
    }

    const { user } = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: 'Select email account:',
        choices: accounts.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
      },
    ]);

    const filterSpinner = ora({ text: 'Fetching filters...', spinner: 'dots12', color: 'cyan' }).start();
    const filters = await listEmailFilters(creds, targetDomain, user);
    filterSpinner.stop();

    if (filters.length === 0) {
      console.log(theme.muted(`  No filters found for ${user}@${targetDomain}.\n`));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('Name'), chalk.hex('#6C63FF')('Details')],
      style: { head: [], border: ['gray'] },
      chars: tableChars,
    });

    for (let i = 0; i < filters.length; i++) {
      const f = filters[i];
      const name = typeof f === 'string' ? f : f.name || `Filter ${i + 1}`;
      const details = typeof f === 'string' ? '' : f.value || JSON.stringify(f);
      table.push([
        chalk.gray(`${i + 1}`),
        chalk.white(name),
        chalk.cyan(typeof details === 'string' ? details : JSON.stringify(details)),
      ]);
    }

    console.log(table.toString());
    console.log(
      theme.muted(`\n  ${filters.length} filter${filters.length !== 1 ? 's' : ''} for ${user}@${targetDomain}\n`),
    );
  } catch (err: any) {
    acctSpinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function filtersCreate(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Create Email Filter on ${targetDomain}`));

  const acctSpinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    acctSpinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No email accounts found.\n'));
      return;
    }

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: 'Select email account:',
        choices: accounts.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
      },
      {
        type: 'input',
        name: 'filterName',
        message: theme.secondary('Filter name:'),
        validate: (input: string) => (input.trim() ? true : 'Filter name is required'),
      },
      {
        type: 'list',
        name: 'field',
        message: 'Match field:',
        choices: [
          { name: 'From', value: 'from' },
          { name: 'To', value: 'to' },
          { name: 'Subject', value: 'subject' },
          { name: 'Body', value: 'body' },
        ],
      },
      {
        type: 'list',
        name: 'matchType',
        message: 'Match type:',
        choices: [
          { name: 'Contains', value: 'contains' },
          { name: 'Equals', value: 'equals' },
          { name: 'Starts with', value: 'startswith' },
          { name: 'Ends with', value: 'endswith' },
        ],
      },
      {
        type: 'input',
        name: 'matchValue',
        message: theme.secondary('Value to match:'),
        validate: (input: string) => (input.trim() ? true : 'Match value is required'),
      },
      {
        type: 'list',
        name: 'action',
        message: 'Action:',
        choices: [
          { name: 'Discard', value: 'discard' },
          { name: 'Forward to address', value: 'forward' },
          { name: 'Move to folder', value: 'move' },
        ],
      },
      {
        type: 'input',
        name: 'destination',
        message: (answers: any) =>
          answers.action === 'forward'
            ? theme.secondary('Forward to (email address):')
            : theme.secondary('Move to folder:'),
        when: (answers: any) => answers.action === 'forward' || answers.action === 'move',
        validate: (input: string, answers: any) => {
          if (!input.trim())
            return answers.action === 'forward' ? 'Email address is required' : 'Folder name is required';
          if (answers.action === 'forward' && !input.includes('@')) return 'Enter a valid email address';
          return true;
        },
      },
    ]);

    const summary = `${answers.field} ${answers.matchType} "${answers.matchValue}" -> ${answers.action}${answers.destination ? ` (${answers.destination})` : ''}`;

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Create filter "${answers.filterName}" for ${answers.user}@${targetDomain}?\n  Rule: ${summary}`,
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const filterData: Record<string, string> = {
      name: answers.filterName,
      field: answers.field,
      match: answers.matchType,
      val: answers.matchValue,
      action: answers.action,
    };

    if (answers.destination) {
      filterData.dest = answers.destination;
    }

    const spinner = ora({ text: 'Creating filter...', spinner: 'dots12', color: 'cyan' }).start();
    const result = await createEmailFilter(creds, targetDomain, answers.user, filterData);

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to create filter'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      spinner.succeed(chalk.green(`Filter "${answers.filterName}" created for ${answers.user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    acctSpinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function filtersDelete(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Delete Email Filter on ${targetDomain}`));

  const acctSpinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    acctSpinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No email accounts found.\n'));
      return;
    }

    const { user } = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: 'Select email account:',
        choices: accounts.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
      },
    ]);

    const filterSpinner = ora({ text: 'Fetching filters...', spinner: 'dots12', color: 'cyan' }).start();
    const filters = await listEmailFilters(creds, targetDomain, user);
    filterSpinner.stop();

    if (filters.length === 0) {
      console.log(theme.muted(`  No filters to delete for ${user}@${targetDomain}.\n`));
      return;
    }

    const filterChoices = filters.map((f, i) => {
      const name = typeof f === 'string' ? f : f.name || `Filter ${i + 1}`;
      return { name, value: name };
    });

    const { filterName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'filterName',
        message: 'Select filter to delete:',
        choices: filterChoices,
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red(`Delete filter "${filterName}" from ${user}@${targetDomain}?`),
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const delSpinner = ora({ text: 'Deleting filter...', spinner: 'dots12', color: 'red' }).start();
    const result = await deleteEmailFilter(creds, targetDomain, user, filterName);

    if (result.error && result.error !== '0') {
      delSpinner.fail(chalk.red('Failed to delete filter'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      delSpinner.succeed(chalk.green(`Deleted filter "${filterName}" from ${user}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    acctSpinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
