import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig, setConfig } from '../utils/config';
import { testAuth } from '../utils/management';
import { resolveManagementCredentials } from '../utils/shared';

export async function authStatus(): Promise<void> {
  const config = getConfig();
  const credentials = resolveManagementCredentials(config);

  console.log(theme.heading('Authentication Status'));

  if (!credentials) {
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
        theme.keyValue(
          'Backend',
          config.managementBackend === 'mxroute-api' ? 'MXroute API' : 'DirectAdmin (legacy)',
          0,
        ),
        theme.keyValue(
          'Server',
          config.managementBackend === 'mxroute-api' ? config.apiServer : `${config.server}.mxrouting.net:2222`,
          0,
        ),
        theme.keyValue(
          'Username',
          config.managementBackend === 'mxroute-api' ? config.apiUsername : config.daUsername,
          0,
        ),
        theme.keyValue('API Key', '••••••••', 0),
        theme.keyValue('Legacy DirectAdmin', config.daLoginKey ? 'configured' : 'not configured', 0),
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
    const result = await testAuth(credentials);

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

  if (!resolveManagementCredentials(config) && !config.daLoginKey) {
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
    setConfig('managementBackend', 'directadmin');
    setConfig('apiServer', '');
    setConfig('apiUsername', '');
    setConfig('apiKey', '');
    setConfig('daUsername', '');
    setConfig('daLoginKey', '');
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Credentials removed.\n`));
  } else {
    console.log(theme.muted('\n  Cancelled.\n'));
  }
}
