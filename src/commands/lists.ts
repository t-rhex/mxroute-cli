import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import {
  listMailingLists,
  getMailingListMembers,
  createMailingList,
  deleteMailingList,
  addMailingListMember,
  removeMailingListMember,
} from '../utils/directadmin';
import { getCreds, pickDomain, tableChars, validateEmail } from '../utils/shared';
import { isJsonMode, output } from '../utils/json-output';

export async function mailingListsList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  if (!isJsonMode()) console.log(theme.heading(`Mailing Lists: ${targetDomain}`));

  const spinner = isJsonMode()
    ? null
    : ora({ text: 'Fetching mailing lists...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const lists = await listMailingLists(creds, targetDomain);
    spinner?.stop();

    if (isJsonMode()) {
      output('domain', targetDomain);
      output('lists', lists);
      return;
    }

    if (lists.length === 0) {
      console.log(theme.muted('  No mailing lists found.'));
      console.log(theme.muted(`  Create one with: ${theme.bold(`mxroute lists create ${targetDomain}`)}\n`));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('List Name'), chalk.hex('#6C63FF')('Address')],
      style: { head: [], border: ['gray'] },
      chars: tableChars,
    });

    for (let i = 0; i < lists.length; i++) {
      const name = lists[i];
      table.push([chalk.gray(`${i + 1}`), chalk.white(name), chalk.cyan(`${name}@${targetDomain}`)]);
    }

    console.log(table.toString());
    console.log(theme.muted(`\n  ${lists.length} mailing list${lists.length !== 1 ? 's' : ''}\n`));
  } catch (err: any) {
    spinner?.fail(chalk.red('Failed to fetch mailing lists'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function mailingListsCreate(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Create Mailing List on ${targetDomain}`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: theme.secondary(`List name (before @${targetDomain}):`),
      validate: (input: string) => {
        if (!input.trim()) return 'List name is required';
        if (input.includes('@')) return 'Enter just the list name part';
        if (!/^[a-zA-Z0-9._-]+$/.test(input))
          return 'List name can only contain letters, numbers, dots, hyphens, and underscores';
        return true;
      },
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Create mailing list ${answers.name}@${targetDomain}?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({ text: 'Creating mailing list...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await createMailingList(creds, targetDomain, answers.name);

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to create mailing list'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      spinner.succeed(chalk.green(`Mailing list created: ${answers.name}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to create mailing list'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function mailingListsDelete(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Delete Mailing List on ${targetDomain}`));

  const spinner = ora({ text: 'Fetching mailing lists...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const lists = await listMailingLists(creds, targetDomain);
    spinner.stop();

    if (lists.length === 0) {
      console.log(theme.muted('  No mailing lists to delete.\n'));
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: 'Select mailing list to delete:',
        choices: lists.map((l) => ({ name: `${l}@${targetDomain}`, value: l })),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Delete mailing list ${name}@${targetDomain}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const delSpinner = ora({ text: 'Deleting mailing list...', spinner: 'dots12', color: 'red' }).start();
    const result = await deleteMailingList(creds, targetDomain, name);

    if (result.error && result.error !== '0') {
      delSpinner.fail(chalk.red('Failed to delete mailing list'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      delSpinner.succeed(chalk.green(`Deleted mailing list ${name}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function mailingListsMembers(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Mailing List Members: ${targetDomain}`));

  const listSpinner = ora({ text: 'Fetching mailing lists...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const lists = await listMailingLists(creds, targetDomain);
    listSpinner.stop();

    if (lists.length === 0) {
      console.log(theme.muted('  No mailing lists found.\n'));
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: 'Select mailing list:',
        choices: lists.map((l) => ({ name: `${l}@${targetDomain}`, value: l })),
      },
    ]);

    const memberSpinner = ora({ text: 'Fetching members...', spinner: 'dots12', color: 'cyan' }).start();
    const members = await getMailingListMembers(creds, targetDomain, name);
    memberSpinner.stop();

    if (members.length === 0) {
      console.log(theme.muted(`  No members in ${name}@${targetDomain}.\n`));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('Member')],
      style: { head: [], border: ['gray'] },
      chars: tableChars,
    });

    for (let i = 0; i < members.length; i++) {
      table.push([chalk.gray(`${i + 1}`), chalk.white(members[i])]);
    }

    console.log(table.toString());
    console.log(
      theme.muted(`\n  ${members.length} member${members.length !== 1 ? 's' : ''} in ${name}@${targetDomain}\n`),
    );
  } catch (err: any) {
    listSpinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function mailingListsAddMember(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Add Member to Mailing List on ${targetDomain}`));

  const listSpinner = ora({ text: 'Fetching mailing lists...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const lists = await listMailingLists(creds, targetDomain);
    listSpinner.stop();

    if (lists.length === 0) {
      console.log(theme.muted('  No mailing lists found.\n'));
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: 'Select mailing list:',
        choices: lists.map((l) => ({ name: `${l}@${targetDomain}`, value: l })),
      },
    ]);

    const { email } = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: theme.secondary('Email address to add:'),
        validate: validateEmail,
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Add ${email} to ${name}@${targetDomain}?`,
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const spinner = ora({ text: 'Adding member...', spinner: 'dots12', color: 'cyan' }).start();
    const result = await addMailingListMember(creds, targetDomain, name, email);

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to add member'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      spinner.succeed(chalk.green(`Added ${email} to ${name}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    listSpinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function mailingListsRemoveMember(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Remove Member from Mailing List on ${targetDomain}`));

  const listSpinner = ora({ text: 'Fetching mailing lists...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const lists = await listMailingLists(creds, targetDomain);
    listSpinner.stop();

    if (lists.length === 0) {
      console.log(theme.muted('  No mailing lists found.\n'));
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: 'Select mailing list:',
        choices: lists.map((l) => ({ name: `${l}@${targetDomain}`, value: l })),
      },
    ]);

    const memberSpinner = ora({ text: 'Fetching members...', spinner: 'dots12', color: 'cyan' }).start();
    const members = await getMailingListMembers(creds, targetDomain, name);
    memberSpinner.stop();

    if (members.length === 0) {
      console.log(theme.muted(`  No members in ${name}@${targetDomain}.\n`));
      return;
    }

    const { email } = await inquirer.prompt([
      {
        type: 'list',
        name: 'email',
        message: 'Select member to remove:',
        choices: members,
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Remove ${email} from ${name}@${targetDomain}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const delSpinner = ora({ text: 'Removing member...', spinner: 'dots12', color: 'red' }).start();
    const result = await removeMailingListMember(creds, targetDomain, name, email);

    if (result.error && result.error !== '0') {
      delSpinner.fail(chalk.red('Failed to remove member'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      delSpinner.succeed(chalk.green(`Removed ${email} from ${name}@${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    listSpinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
