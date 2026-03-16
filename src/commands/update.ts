// NOTE: execSync is used here with fixed, hardcoded command strings only (no user input),
// so there is no shell injection risk.

import { execSync } from 'child_process';
import ora from 'ora';
import { theme } from '../utils/theme';

export async function updateCommand(): Promise<void> {
  const pkg = require('../../package.json');
  const currentVersion: string = pkg.version;

  console.log(theme.heading('Update MXroute CLI'));
  console.log(theme.keyValue('Current version', currentVersion));

  // Check latest version from npm
  const spinner = ora({ text: 'Checking for updates...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const latest = execSync('npm view mxroute-cli version', { encoding: 'utf-8', timeout: 10000 }).trim();
    spinner.stop();

    console.log(theme.keyValue('Latest version', latest));
    console.log('');

    if (currentVersion === latest) {
      console.log(theme.success(`  ${theme.statusIcon('pass')} Already up to date!\n`));
      return;
    }

    console.log(theme.info(`  ${theme.statusIcon('info')} Update available: ${currentVersion} → ${latest}\n`));

    const updateSpinner = ora({ text: 'Updating...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      execSync('npm install -g mxroute-cli@latest', { encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
      updateSpinner.succeed('Updated successfully!');
      console.log(theme.muted(`\n  Restart your terminal or run mxroute --version to verify.\n`));
    } catch (err: any) {
      updateSpinner.fail('Update failed');
      console.log(theme.error(`  ${err.message}`));
      console.log(theme.muted('\n  Try manually: npm install -g mxroute-cli@latest\n'));
    }
  } catch (err: any) {
    spinner.fail('Could not check for updates');
    console.log(theme.error(`  ${err.message}\n`));
  }
}
