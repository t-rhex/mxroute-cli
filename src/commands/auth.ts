import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig, setConfig } from '../utils/config';
import { testAuth } from '../utils/directadmin';

export async function authLogin(): Promise<void> {
  console.log(theme.heading('Authenticate with MXroute'));

  const config = getConfig();

  console.log(theme.muted('  To create a Login Key:'));
  console.log(theme.muted('    1. Log into your MXroute Control Panel (panel.mxroute.com)'));
  console.log(theme.muted('    2. Go to Login Keys (or API Keys)'));
  console.log(theme.muted('    3. Create a new key with the permissions you need'));
  console.log(theme.muted('    4. Copy the generated key'));
  console.log('');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'server',
      message: theme.secondary('Server hostname:'),
      default: config.server || '',
      validate: (input: string) => (input.trim() ? true : 'Server is required (e.g., tuesday)'),
      filter: (input: string) => input.replace('.mxrouting.net', '').replace(':2222', '').trim(),
    },
    {
      type: 'input',
      name: 'username',
      message: theme.secondary('DirectAdmin username:'),
      default: config.daUsername || '',
      validate: (input: string) => (input.trim() ? true : 'Username is required'),
    },
    {
      type: 'password',
      name: 'loginKey',
      message: theme.secondary('Login Key:'),
      mask: '•',
      validate: (input: string) => (input.trim() ? true : 'Login key is required'),
    },
  ]);

  const spinner = ora({
    text: 'Testing authentication...',
    spinner: 'dots12',
    color: 'cyan',
  }).start();

  try {
    const result = await testAuth({
      server: answers.server,
      username: answers.username,
      loginKey: answers.loginKey,
    });

    if (result.success) {
      spinner.succeed(chalk.green('Authentication successful!'));

      setConfig('server', answers.server);
      setConfig('daUsername', answers.username);
      setConfig('daLoginKey', answers.loginKey);

      console.log('');
      console.log(
        theme.box(
          [
            theme.keyValue('Server', `${answers.server}.mxrouting.net:2222`, 0),
            theme.keyValue('Username', answers.username, 0),
            theme.keyValue('Login Key', '••••••••', 0),
          ].join('\n'),
          'Credentials Saved',
        ),
      );
      console.log('');
      console.log(theme.muted(`  You can now use: mxroute domains, mxroute accounts, mxroute forwarders\n`));
    } else {
      spinner.fail(chalk.red('Authentication failed'));
      console.log(theme.error(`\n  ${result.message}\n`));
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Authentication failed'));
    console.log(theme.error(`\n  ${err.message}\n`));
  }
}

export async function authStatus(): Promise<void> {
  const config = getConfig();

  console.log(theme.heading('Authentication Status'));

  if (!config.daUsername || !config.daLoginKey) {
    console.log(
      theme.warning(
        `  ${theme.statusIcon('warn')} Not authenticated. Run ${theme.bold('mxroute auth login')} to connect.\n`,
      ),
    );
    return;
  }

  console.log(
    theme.box(
      [
        theme.keyValue('Server', `${config.server}.mxrouting.net:2222`, 0),
        theme.keyValue('Username', config.daUsername, 0),
        theme.keyValue('Login Key', '••••••••', 0),
      ].join('\n'),
      'Stored Credentials',
    ),
  );
  console.log('');

  const spinner = ora({
    text: 'Verifying credentials...',
    spinner: 'dots12',
    color: 'cyan',
  }).start();

  try {
    const result = await testAuth({
      server: config.server,
      username: config.daUsername,
      loginKey: config.daLoginKey,
    });

    if (result.success) {
      spinner.succeed(chalk.green('Credentials are valid'));
    } else {
      spinner.fail(chalk.red(`Credentials invalid: ${result.message}`));
      console.log(theme.muted(`\n  Run ${theme.bold('mxroute auth login')} to re-authenticate.\n`));
    }
  } catch (err: any) {
    spinner.fail(chalk.red(`Connection failed: ${err.message}`));
  }
  console.log('');
}

export async function authLogout(): Promise<void> {
  const config = getConfig();

  if (!config.daUsername && !config.daLoginKey) {
    console.log(theme.muted('\n  No credentials stored.\n'));
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Remove stored credentials?',
      default: false,
    },
  ]);

  if (confirm) {
    setConfig('daUsername', '');
    setConfig('daLoginKey', '');
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Credentials removed.\n`));
  } else {
    console.log(theme.muted('\n  Cancelled.\n'));
  }
}
