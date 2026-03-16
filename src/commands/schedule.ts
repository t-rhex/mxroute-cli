import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { theme } from '../utils/theme';
import { createAutoresponder, deleteAutoresponder, listEmailAccounts } from '../utils/directadmin';
import { getCreds, pickDomain } from '../utils/shared';
import { getConfigPath } from '../utils/config';

interface ScheduleEntry {
  id: string;
  domain: string;
  user: string;
  message: string;
  startDate: string;
  endDate: string;
  enabled: boolean;
  createdAt: string;
}

const SCHEDULE_FILE = 'autoresponder-schedules.json';

function getSchedulePath(): string {
  return path.join(path.dirname(getConfigPath()), SCHEDULE_FILE);
}

function loadSchedules(): ScheduleEntry[] {
  try {
    return JSON.parse(fs.readFileSync(getSchedulePath(), 'utf-8'));
  } catch {
    return [];
  }
}

function saveSchedules(schedules: ScheduleEntry[]): void {
  fs.writeFileSync(getSchedulePath(), JSON.stringify(schedules, null, 2), { mode: 0o600 });
}

export async function scheduleCreate(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Schedule Autoresponder: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();
  let accounts: string[];

  try {
    accounts = await listEmailAccounts(creds, targetDomain);
    spinner.stop();
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to fetch accounts'));
    console.log(theme.error(`  ${err.message}\n`));
    return;
  }

  if (accounts.length === 0) {
    console.log(theme.muted('  No email accounts found.\n'));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'user',
      message: 'Select account:',
      choices: accounts.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
    },
    {
      type: 'input',
      name: 'startDate',
      message: theme.secondary('Start date (YYYY-MM-DD):'),
      validate: (input: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return 'Use format YYYY-MM-DD';
        const d = new Date(input);
        if (isNaN(d.getTime())) return 'Invalid date';
        return true;
      },
    },
    {
      type: 'input',
      name: 'endDate',
      message: theme.secondary('End date (YYYY-MM-DD):'),
      validate: (input: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return 'Use format YYYY-MM-DD';
        const d = new Date(input);
        if (isNaN(d.getTime())) return 'Invalid date';
        return true;
      },
    },
    {
      type: 'editor',
      name: 'message',
      message: theme.secondary('Autoresponder message (opens editor):'),
    },
  ]);

  const startDate = new Date(answers.startDate);
  const endDate = new Date(answers.endDate);

  if (endDate <= startDate) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} End date must be after start date.\n`));
    return;
  }

  const entry: ScheduleEntry = {
    id: Math.random().toString(36).substring(2, 10),
    domain: targetDomain,
    user: answers.user,
    message: answers.message.trim(),
    startDate: answers.startDate,
    endDate: answers.endDate,
    enabled: false,
    createdAt: new Date().toISOString(),
  };

  // If start date is today or in the past, enable immediately
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (startDate <= now && endDate > now) {
    const enableSpinner = ora({ text: 'Enabling autoresponder...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const result = await createAutoresponder(creds, targetDomain, answers.user, answers.message.trim());
      if (result.error && result.error !== '0') {
        enableSpinner.fail(chalk.red('Failed to enable autoresponder'));
        console.log(theme.error(`  ${result.text || result.details || 'Unknown error'}\n`));
        return;
      }
      entry.enabled = true;
      enableSpinner.succeed(chalk.green('Autoresponder enabled'));
    } catch (err: any) {
      enableSpinner.fail(chalk.red(`Failed: ${err.message}`));
      return;
    }
  }

  const schedules = loadSchedules();
  schedules.push(entry);
  saveSchedules(schedules);

  const lines = [
    theme.keyValue('Account', `${answers.user}@${targetDomain}`, 0),
    theme.keyValue('Start', answers.startDate, 0),
    theme.keyValue('End', answers.endDate, 0),
    theme.keyValue('Status', entry.enabled ? chalk.green('Active') : chalk.yellow('Scheduled'), 0),
  ];

  console.log('');
  console.log(theme.box(lines.join('\n'), 'Schedule Created'));
  console.log('');

  if (!entry.enabled) {
    console.log(theme.muted('  The autoresponder will activate on the start date.'));
    console.log(theme.muted(`  Run ${theme.bold('mxroute schedule check')} to process scheduled changes.\n`));
  } else {
    console.log(theme.muted(`  The autoresponder will be disabled on ${answers.endDate}.`));
    console.log(theme.muted(`  Run ${theme.bold('mxroute schedule check')} on that date to disable it.\n`));
  }

  console.log(theme.warning(`\n  ${theme.statusIcon('warn')} Schedules need periodic checking to activate.`));
  console.log(theme.muted(`  The schedule will be applied when mxroute schedule check runs.`));
  console.log(theme.muted(`  Set up automatic checking: mxroute cron setup\n`));
}

export async function scheduleList(): Promise<void> {
  console.log(theme.heading('Scheduled Autoresponders'));

  const schedules = loadSchedules();

  if (schedules.length === 0) {
    console.log(theme.muted('  No scheduled autoresponders.'));
    console.log(theme.muted(`  Create one with: ${theme.bold('mxroute schedule create')}\n`));
    return;
  }

  const now = new Date();

  for (const s of schedules) {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    let status: string;

    if (end < now) {
      status = theme.muted('Expired');
    } else if (s.enabled) {
      status = chalk.green('Active');
    } else if (start <= now) {
      status = chalk.yellow('Pending activation');
    } else {
      status = chalk.cyan('Scheduled');
    }

    console.log(`  ${theme.statusIcon('info')} ${theme.bold(`${s.user}@${s.domain}`)} ${status}`);
    console.log(theme.muted(`      ${s.startDate} \u2192 ${s.endDate}`));
  }
  console.log('');
}

export async function scheduleCheck(): Promise<void> {
  const creds = getCreds();

  console.log(theme.heading('Process Scheduled Autoresponders'));

  const schedules = loadSchedules();
  if (schedules.length === 0) {
    console.log(theme.muted('  No schedules to process.\n'));
    return;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let changes = 0;

  for (const s of schedules) {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);

    // Enable if start date reached and not yet enabled
    if (!s.enabled && start <= now && end > now) {
      const spinner = ora({
        text: `Enabling autoresponder for ${s.user}@${s.domain}...`,
        spinner: 'dots12',
        color: 'cyan',
      }).start();
      try {
        await createAutoresponder(creds, s.domain, s.user, s.message);
        s.enabled = true;
        spinner.succeed(chalk.green(`Enabled: ${s.user}@${s.domain}`));
        changes++;
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed to enable ${s.user}@${s.domain}: ${err.message}`));
      }
    }

    // Disable if end date reached
    if (s.enabled && end <= now) {
      const spinner = ora({
        text: `Disabling autoresponder for ${s.user}@${s.domain}...`,
        spinner: 'dots12',
        color: 'cyan',
      }).start();
      try {
        await deleteAutoresponder(creds, s.domain, s.user);
        s.enabled = false;
        spinner.succeed(chalk.green(`Disabled: ${s.user}@${s.domain}`));
        changes++;
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed to disable ${s.user}@${s.domain}: ${err.message}`));
      }
    }
  }

  // Remove expired schedules
  const active = schedules.filter((s) => new Date(s.endDate) > now || s.enabled);
  saveSchedules(active);

  if (changes === 0) {
    console.log(theme.muted('  No changes needed.\n'));
  } else {
    console.log(
      theme.success(`\n  ${theme.statusIcon('pass')} ${changes} schedule${changes === 1 ? '' : 's'} processed.\n`),
    );
  }
}
