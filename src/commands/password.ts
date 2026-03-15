import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { changeEmailPassword } from '../utils/directadmin';
import { getCreds } from '../utils/shared';
import { ImapClient } from '../utils/imap';

export async function selfServicePasswordChange(): Promise<void> {
  const config = getConfig();

  if (!config.username) {
    console.log(theme.error('\n  No user configured. Run mxroute config setup first.\n'));
    process.exit(1);
  }

  console.log(theme.heading('Change Your Password'));
  console.log(theme.muted(`  Account: ${config.username}\n`));

  const { currentPassword } = await inquirer.prompt([
    {
      type: 'password',
      name: 'currentPassword',
      message: theme.secondary('Current password:'),
      mask: '•',
      validate: (input: string) => (input.length > 0 ? true : 'Password is required'),
    },
  ]);

  const verifySpinner = ora({ text: 'Verifying current password...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const imap = new ImapClient({
      host: `${config.server}.mxrouting.net`,
      port: 993,
      user: config.username,
      password: currentPassword,
    });
    await imap.connect();
    await imap.login();
    await imap.logout();
    imap.disconnect();
    verifySpinner.succeed(chalk.green('Current password verified'));
  } catch {
    verifySpinner.fail(chalk.red('Authentication failed'));
    console.log(theme.error(`  Invalid current password. Please try again.\n`));
    process.exit(1);
  }

  const { newPassword } = await inquirer.prompt([
    {
      type: 'password',
      name: 'newPassword',
      message: theme.secondary('New password (min 8 chars, mix of upper/lower/numbers):'),
      mask: '•',
      validate: (input: string) => {
        if (input.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(input) || !/[a-z]/.test(input) || !/[0-9]/.test(input)) {
          return 'Weak password — use a mix of uppercase, lowercase, and numbers';
        }
        return true;
      },
    },
  ]);

  await inquirer.prompt([
    {
      type: 'password',
      name: 'confirmPassword',
      message: theme.secondary('Confirm new password:'),
      mask: '•',
      validate: (input: string) => (input === newPassword ? true : 'Passwords do not match'),
    },
  ]);

  const [user, domain] = config.username.split('@');
  const creds = getCreds();

  const updateSpinner = ora({ text: 'Updating password...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await changeEmailPassword(creds, domain, user, newPassword);

    if (result.error && result.error !== '0') {
      updateSpinner.fail(chalk.red('Failed to change password'));
      const msg = result.text || result.details || 'Unknown error — check credentials and try again';
      console.log(theme.error(`  ${msg}\n`));
    } else {
      updateSpinner.succeed(chalk.green('Password changed successfully'));
      console.log(theme.muted(`\n  Your password for ${config.username} has been updated.\n`));
    }
  } catch (err: any) {
    updateSpinner.fail(chalk.red('Failed to change password'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}
