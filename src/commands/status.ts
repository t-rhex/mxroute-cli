import chalk from 'chalk';
import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { runFullDnsCheck } from '../utils/dns';
import { testAuth } from '../utils/directadmin';
import { testConnection } from '../utils/api';

export async function statusCommand(): Promise<void> {
  const config = getConfig();

  console.log(theme.banner());

  // Not configured at all
  if (!config.server && !config.daUsername) {
    console.log(
      theme.warning(
        `  ${theme.statusIcon('warn')} Not configured yet. Run ${theme.bold('mxroute config setup')} to get started.\n`,
      ),
    );
    console.log(theme.subheading('Quick Start:'));
    console.log(theme.muted('    1. mxroute config setup     Configure your account (API key + server)'));
    console.log(theme.muted('    2. mxroute dns check        Verify DNS records'));
    console.log(theme.muted('    3. mxroute domains list     List your domains'));
    console.log(theme.muted('    4. mxroute info             View connection settings'));
    console.log('');
    return;
  }

  // Account info box
  const accountLines = [
    theme.keyValue('Profile', config.activeProfile, 0),
    theme.keyValue('Server', config.server ? `${config.server}.mxrouting.net` : theme.muted('not set'), 0),
    theme.keyValue('Domain', config.domain || theme.muted('not set'), 0),
  ];
  console.log(theme.box(accountLines.join('\n'), 'Account'));
  console.log('');

  // Auth status
  console.log(theme.subheading('Authentication'));
  if (config.daUsername && config.daLoginKey) {
    const spinner = ora({ text: 'Verifying API credentials...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const result = await testAuth({
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      });
      if (result.success) {
        spinner.stop();
        console.log(
          `    ${theme.statusIcon('pass')} ${theme.success('DirectAdmin API')}  ${theme.muted(`authenticated as ${config.daUsername}`)}`,
        );
      } else {
        spinner.stop();
        console.log(
          `    ${theme.statusIcon('fail')} ${theme.error('DirectAdmin API')}  ${theme.muted(result.message)}`,
        );
      }
    } catch (err: any) {
      spinner.stop();
      console.log(`    ${theme.statusIcon('fail')} ${theme.error('DirectAdmin API')}  ${theme.muted(err.message)}`);
    }
  } else {
    console.log(
      `    ${theme.statusIcon('warn')} ${theme.warning('DirectAdmin API')}  ${theme.muted('not configured')}`,
    );
    console.log(
      theme.muted(`           Run ${theme.bold('mxroute config setup')} to authenticate with your Login Key`),
    );
  }

  if (config.username && config.password) {
    console.log(
      `    ${theme.statusIcon('pass')} ${theme.success('SMTP API')}          ${theme.muted(config.username)}`,
    );
  } else {
    console.log(
      `    ${theme.statusIcon('info')} ${theme.muted('SMTP API')}          ${theme.muted('not configured (optional — run mxroute config smtp)')}`,
    );
  }
  console.log('');

  // DNS Check
  if (config.domain && config.server) {
    const spinner = ora({ text: 'Running DNS health check...', spinner: 'dots12', color: 'cyan' }).start();

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

  // SMTP connection test (only if configured)
  if (config.username && config.password) {
    const apiSpinner = ora({ text: 'Testing SMTP API...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const result = await testConnection(`${config.server}.mxrouting.net`, config.username, config.password);
      if (result.success) {
        apiSpinner.succeed(chalk.green('SMTP API connection successful'));
      } else {
        apiSpinner.warn(chalk.yellow(`SMTP API: ${result.message}`));
      }
    } catch (err: any) {
      apiSpinner.fail(chalk.red(`SMTP API: ${err.message}`));
    }
    console.log('');
  }
}
