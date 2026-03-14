import chalk from 'chalk';
import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { runFullDnsCheck } from '../utils/dns';
import { testConnection } from '../utils/api';

export async function statusCommand(): Promise<void> {
  const config = getConfig();

  console.log(theme.banner());

  if (!config.server || !config.username) {
    console.log(
      theme.warning(
        `  ${theme.statusIcon('warn')} Not configured yet. Run ${theme.bold('mxroute config setup')} to get started.\n`,
      ),
    );
    console.log(theme.subheading('Quick Start:'));
    console.log(theme.muted('    1. mxroute config setup     Configure your account'));
    console.log(theme.muted('    2. mxroute dns check        Verify DNS records'));
    console.log(theme.muted('    3. mxroute send             Send an email'));
    console.log(theme.muted('    4. mxroute info             View connection settings'));
    console.log('');
    return;
  }

  console.log(
    theme.box(
      [
        theme.keyValue('Profile', config.activeProfile, 0),
        theme.keyValue('Server', `${config.server}.mxrouting.net`, 0),
        theme.keyValue('Account', config.username, 0),
        theme.keyValue('Domain', config.domain, 0),
      ].join('\n'),
      'Account',
    ),
  );
  console.log('');

  // DNS Check
  if (config.domain) {
    const spinner = ora({
      text: 'Running DNS health check...',
      spinner: 'dots12',
      color: 'cyan',
    }).start();

    try {
      const results = await runFullDnsCheck(config.domain, config.server);
      spinner.stop();

      const passed = results.filter((r) => r.status === 'pass').length;
      const total = results.length;

      console.log(theme.subheading('DNS Health'));
      for (const result of results) {
        const icon = theme.statusIcon(result.status);
        console.log(`    ${icon} ${result.type.padEnd(6)} ${theme.muted(result.message)}`);
      }

      const scoreColor = passed === total ? theme.success : passed >= total - 2 ? theme.warning : theme.error;
      console.log(`\n    ${scoreColor(`Score: ${passed}/${total}`)}`);
      console.log('');
    } catch {
      spinner.stop();
      console.log(theme.muted('    Could not check DNS\n'));
    }
  }

  // API Connection Test
  const apiSpinner = ora({
    text: 'Testing SMTP API connection...',
    spinner: 'dots12',
    color: 'cyan',
  }).start();

  try {
    const result = await testConnection(`${config.server}.mxrouting.net`, config.username, config.password);
    if (result.success) {
      apiSpinner.succeed(chalk.green('SMTP API connection successful'));
    } else {
      apiSpinner.warn(chalk.yellow(`SMTP API: ${result.message}`));
    }
  } catch (err: any) {
    apiSpinner.fail(chalk.red(`SMTP API unreachable: ${err.message}`));
  }
  console.log('');
}
