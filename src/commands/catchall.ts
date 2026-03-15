import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getCatchAll, setCatchAll, listEmailAccounts } from '../utils/directadmin';
import { getCreds, pickDomain, validateEmail } from '../utils/shared';

export async function catchallGet(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Catch-All: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching catch-all setting...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const value = await getCatchAll(creds, targetDomain);
    spinner.stop();

    if (!value || value === ':blackhole:') {
      console.log(
        theme.box(
          [
            theme.keyValue('Domain', targetDomain, 0),
            theme.keyValue('Catch-All', 'Disabled (messages are discarded)', 0),
          ].join('\n'),
          'Catch-All Setting',
        ),
      );
    } else if (value === ':fail:') {
      console.log(
        theme.box(
          [
            theme.keyValue('Domain', targetDomain, 0),
            theme.keyValue('Catch-All', 'Reject (sender receives bounce)', 0),
          ].join('\n'),
          'Catch-All Setting',
        ),
      );
    } else {
      console.log(
        theme.box(
          [theme.keyValue('Domain', targetDomain, 0), theme.keyValue('Catch-All', `Forward to ${value}`, 0)].join('\n'),
          'Catch-All Setting',
        ),
      );
    }

    console.log('');
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to fetch catch-all setting'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function catchallSet(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Set Catch-All for ${targetDomain}`));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What should happen to emails sent to non-existent addresses?',
      choices: [
        { name: 'Forward to an existing account', value: 'existing' },
        { name: 'Forward to a custom email address', value: 'custom' },
        { name: 'Reject (bounce back to sender)', value: 'reject' },
        { name: 'Disable (silently discard)', value: 'disable' },
      ],
    },
  ]);

  let catchAllValue: string;

  if (action === 'existing') {
    const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

    try {
      const accounts = await listEmailAccounts(creds, targetDomain);
      spinner.stop();

      if (accounts.length === 0) {
        console.log(theme.error(`\n  ${theme.statusIcon('fail')} No email accounts found on ${targetDomain}.\n`));
        return;
      }

      const { account } = await inquirer.prompt([
        {
          type: 'list',
          name: 'account',
          message: 'Forward catch-all to:',
          choices: accounts.map((a) => ({ name: `${a}@${targetDomain}`, value: `${a}@${targetDomain}` })),
        },
      ]);

      catchAllValue = account;
    } catch (err: any) {
      spinner.stop();
      console.log(theme.error(`  ${err.message}\n`));
      return;
    }
  } else if (action === 'custom') {
    const { email } = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: theme.secondary('Forward to email address:'),
        validate: validateEmail,
      },
    ]);

    catchAllValue = email;
  } else if (action === 'reject') {
    catchAllValue = ':fail:';
  } else {
    catchAllValue = ':blackhole:';
  }

  const displayValue =
    catchAllValue === ':fail:'
      ? 'Reject (bounce back to sender)'
      : catchAllValue === ':blackhole:'
        ? 'Disable (silently discard)'
        : `Forward to ${catchAllValue}`;

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Set catch-all for ${targetDomain} to: ${displayValue}?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({ text: 'Updating catch-all...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await setCatchAll(creds, targetDomain, catchAllValue);

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to update catch-all'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      spinner.succeed(chalk.green(`Catch-all updated for ${targetDomain}`));
      console.log('');
      console.log(
        theme.box(
          [theme.keyValue('Domain', targetDomain, 0), theme.keyValue('Catch-All', displayValue, 0)].join('\n'),
          'Catch-All Updated',
        ),
      );
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to update catch-all'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}
