import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { listEmailAccounts, deleteEmailAccount, createForwarder, createAutoresponder } from '../utils/directadmin';
import { getCreds, pickDomain, validateEmail } from '../utils/shared';

export async function deprovisionAccount(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Deprovision Account: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    spinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No accounts to deprovision.\n'));
      return;
    }

    const { user } = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: 'Select account to offboard:',
        choices: accounts.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
      },
    ]);

    const email = `${user}@${targetDomain}`;
    console.log(theme.muted(`\n  Offboarding: ${chalk.red(email)}\n`));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What should happen to this account?',
        choices: [
          { name: 'Forward emails to another account', value: 'forward' },
          { name: 'Set auto-reply and forward', value: 'autoreply_forward' },
          { name: 'Delete immediately', value: 'delete' },
        ],
      },
    ]);

    const actions: string[] = [];

    if (action === 'forward' || action === 'autoreply_forward') {
      const { destination } = await inquirer.prompt([
        {
          type: 'input',
          name: 'destination',
          message: theme.secondary('Forward emails to:'),
          validate: validateEmail,
        },
      ]);

      let autoMessage = '';
      if (action === 'autoreply_forward') {
        const { message } = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: theme.secondary('Auto-reply message:'),
            validate: (input: string) => (input.trim() ? true : 'Message is required'),
          },
        ]);
        autoMessage = message;
      }

      const fwdSpinner = ora({ text: 'Creating forwarder...', spinner: 'dots12', color: 'cyan' }).start();
      const fwdResult = await createForwarder(creds, targetDomain, user, destination);

      if (fwdResult.error && fwdResult.error !== '0') {
        fwdSpinner.fail(chalk.red('Failed to create forwarder'));
        console.log(theme.error(`  ${fwdResult.text || fwdResult.details || 'Unknown error'}\n`));
        return;
      }
      fwdSpinner.succeed(chalk.green(`Forwarder created: ${email} → ${destination}`));
      actions.push(`Forwarding to ${destination}`);

      if (action === 'autoreply_forward') {
        const arSpinner = ora({ text: 'Creating autoresponder...', spinner: 'dots12', color: 'cyan' }).start();
        const arResult = await createAutoresponder(creds, targetDomain, user, autoMessage);

        if (arResult.error && arResult.error !== '0') {
          arSpinner.fail(chalk.red('Failed to create autoresponder'));
          console.log(theme.error(`  ${arResult.text || arResult.details || 'Unknown error'}\n`));
          return;
        }
        arSpinner.succeed(chalk.green(`Autoresponder set for ${email}`));
        actions.push('Auto-reply enabled');
      }
    } else if (action === 'delete') {
      const { confirmDelete } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: chalk.red(`Permanently delete ${email}? This cannot be undone.`),
          default: false,
        },
      ]);

      if (!confirmDelete) {
        console.log(theme.muted('\n  Cancelled.\n'));
        return;
      }

      const delSpinner = ora({ text: 'Deleting account...', spinner: 'dots12', color: 'red' }).start();
      const delResult = await deleteEmailAccount(creds, targetDomain, user);

      if (delResult.error && delResult.error !== '0') {
        delSpinner.fail(chalk.red('Failed to delete account'));
        console.log(theme.error(`  ${delResult.text || delResult.details || 'Unknown error'}\n`));
        return;
      }
      delSpinner.succeed(chalk.green(`Deleted ${email}`));
      actions.push('Account deleted');
    }

    console.log('');
    console.log(theme.subheading('Deprovision summary:'));
    for (const a of actions) {
      console.log(theme.muted(`    ${theme.statusIcon('pass')} ${a}`));
    }
    console.log('');
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
