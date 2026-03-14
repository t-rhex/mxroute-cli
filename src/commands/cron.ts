import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';

// Note: execSync is used here intentionally for crontab management.
// All inputs come from a predefined choices list, not user-typed strings,
// so shell injection is not a concern. Shell piping is required for crontab.

export async function cronSetup(): Promise<void> {
  console.log(theme.heading('Cron Monitor Setup'));
  console.log(theme.muted('  Install a cron job to run mxroute monitor periodically.\n'));

  const mxrouteBin = findMxrouteBin();

  const { interval } = await inquirer.prompt([
    {
      type: 'list',
      name: 'interval',
      message: 'Check interval:',
      choices: [
        { name: 'Every 5 minutes', value: '*/5 * * * *' },
        { name: 'Every 15 minutes', value: '*/15 * * * *' },
        { name: 'Every hour', value: '0 * * * *' },
        { name: 'Every 6 hours', value: '0 */6 * * *' },
        { name: 'Daily at midnight', value: '0 0 * * *' },
      ],
    },
  ]);

  const { alert } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'alert',
      message: 'Send email alert on failure? (requires SMTP config)',
      default: true,
    },
  ]);

  const alertFlag = alert ? ' --alert' : '';
  const cronLine = `${interval} ${mxrouteBin} monitor --quiet${alertFlag} 2>/dev/null`;

  console.log('');
  console.log(theme.subheading('Cron entry:'));
  console.log(theme.muted(`    ${cronLine}`));
  console.log('');

  const { install } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'install',
      message: 'Install this cron job now?',
      default: true,
    },
  ]);

  if (!install) {
    console.log(theme.muted('\n  To install manually: crontab -e\n'));
    return;
  }

  try {
    let existing = '';
    try {
      existing = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    } catch {
      // No existing crontab
    }

    const filtered = existing
      .split('\n')
      .filter((line) => !line.includes('mxroute monitor'))
      .join('\n');

    const newCrontab = filtered.trim() + '\n' + cronLine + '\n';

    execSync(`echo '${newCrontab.replace(/'/g, "'\\''")}' | crontab -`, { encoding: 'utf-8' });

    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Cron job installed`));
    console.log(theme.muted(`  To remove: crontab -e and delete the mxroute line\n`));
  } catch (err: any) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Failed to install cron: ${err.message}`));
    console.log(theme.muted(`  Install manually: crontab -e\n`));
  }
}

export async function cronRemove(): Promise<void> {
  try {
    let existing = '';
    try {
      existing = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    } catch {
      console.log(theme.muted('\n  No crontab found.\n'));
      return;
    }

    const hasMxroute = existing.includes('mxroute monitor');
    if (!hasMxroute) {
      console.log(theme.muted('\n  No mxroute monitor cron job found.\n'));
      return;
    }

    const filtered = existing
      .split('\n')
      .filter((line) => !line.includes('mxroute monitor'))
      .join('\n');

    execSync(`echo '${filtered.replace(/'/g, "'\\''")}' | crontab -`, { encoding: 'utf-8' });
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Cron job removed.\n`));
  } catch (err: any) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} ${err.message}\n`));
  }
}

function findMxrouteBin(): string {
  try {
    return execSync('which mxroute', { encoding: 'utf-8' }).trim();
  } catch {
    return 'mxroute';
  }
}
