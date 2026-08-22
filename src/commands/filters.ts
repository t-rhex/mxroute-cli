import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { listEmailFilters, createEmailFilter, deleteEmailFilter } from '../utils/management';
import { getCreds, pickDomain, tableChars } from '../utils/shared';

export async function filtersList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);
  console.log(theme.heading(`Email Filters: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching filters...', spinner: 'dots12', color: 'cyan' }).start();
  try {
    const filters = await listEmailFilters(creds, targetDomain);
    spinner.stop();

    if (filters.length === 0) {
      console.log(theme.muted(`  No filters found for ${targetDomain}.\n`));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('ID'), chalk.hex('#6C63FF')('Type'), chalk.hex('#6C63FF')('Value')],
      style: { head: [], border: ['gray'] },
      chars: tableChars,
    });

    for (const filter of filters) {
      table.push([chalk.gray(filter.id), chalk.white(filter.type), chalk.cyan(filter.value)]);
    }

    console.log(table.toString());
    console.log(theme.muted(`\n  ${filters.length} filter${filters.length !== 1 ? 's' : ''} for ${targetDomain}\n`));
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function filtersCreate(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);
  console.log(theme.heading(`Create Email Filter on ${targetDomain}`));

  try {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Block messages matching:',
        choices: [
          { name: 'Email address', value: 'email' },
          { name: 'Sender domain', value: 'domain' },
          { name: 'Word or phrase', value: 'word' },
          { name: 'Message size', value: 'size' },
        ],
      },
      {
        type: 'input',
        name: 'value',
        message: theme.secondary('Value to block:'),
        validate: (input: string) => (input.trim() ? true : 'Value is required'),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Block ${answers.type} "${answers.value}" across ${targetDomain}?`,
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const spinner = ora({ text: 'Creating filter...', spinner: 'dots12', color: 'cyan' }).start();
    const result = await createEmailFilter(creds, targetDomain, answers.type, answers.value);

    if (!result.success && result.error !== '0') {
      spinner.fail(chalk.red('Failed to create filter'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error - check credentials and try again'}\n`),
      );
    } else {
      spinner.succeed(chalk.green(`Filter created for ${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function filtersDelete(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);
  console.log(theme.heading(`Delete Email Filter on ${targetDomain}`));

  const spinner = ora({ text: 'Fetching filters...', spinner: 'dots12', color: 'cyan' }).start();
  try {
    const filters = await listEmailFilters(creds, targetDomain);
    spinner.stop();

    if (filters.length === 0) {
      console.log(theme.muted(`  No filters to delete for ${targetDomain}.\n`));
      return;
    }

    const { filterId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'filterId',
        message: 'Select filter to delete:',
        choices: filters.map((filter) => ({
          name: `${filter.id}: ${filter.type} = ${filter.value}`,
          value: filter.id,
        })),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red(`Delete filter ${filterId} from ${targetDomain}?`),
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const deleteSpinner = ora({ text: 'Deleting filter...', spinner: 'dots12', color: 'red' }).start();
    const result = await deleteEmailFilter(creds, targetDomain, filterId);

    if (!result.success && result.error !== '0') {
      deleteSpinner.fail(chalk.red('Failed to delete filter'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error - check credentials and try again'}\n`),
      );
    } else {
      deleteSpinner.succeed(chalk.green(`Deleted filter ${filterId} from ${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
