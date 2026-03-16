import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getQuotaUsage, getUserConfig, listEmailAccounts, changeEmailQuota } from '../utils/directadmin';
import { getCreds, pickDomain } from '../utils/shared';
import { isJsonMode, output } from '../utils/json-output';

function buildBar(used: number, total: number, width = 20): string {
  if (total <= 0) return chalk.hex('#7C8DB0')('unlimited');
  const ratio = Math.min(used / total, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const percent = Math.round(ratio * 100);

  let barColor = theme.success;
  if (percent >= 90) barColor = theme.error;
  else if (percent >= 70) barColor = theme.warning;

  const bar = barColor('='.repeat(filled)) + chalk.hex('#7C8DB0')('-'.repeat(empty));
  return `[${bar}] ${percent}%`;
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  return `${mb}MB`;
}

export async function quotaOverview(): Promise<void> {
  const creds = getCreds();

  if (!isJsonMode()) console.log(theme.heading('Account Quota Overview'));

  const spinner = isJsonMode()
    ? null
    : ora({ text: 'Fetching quota information...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const [usage, config] = await Promise.all([getQuotaUsage(creds), getUserConfig(creds)]);
    spinner?.stop();

    const diskUsed = Number(usage.quota || usage.disk || 0);
    const diskLimit = Number(config.quota || config.disk || 0);
    const bwUsed = Number(usage.bandwidth || 0);
    const bwLimit = Number(config.bandwidth || 0);
    const emailUsed = Number(usage.nemails || usage.email || 0);
    const emailLimit = Number(config.nemails || config.email || 0);
    const domainUsed = Number(usage.vdomains || usage.ndomains || usage.domains || 0);
    const domainLimit = Number(config.vdomains || config.ndomains || config.domains || 0);
    const fwdUsed = Number(usage.ftp || usage.nemailf || usage.forwarders || 0);
    const fwdLimit = Number(config.ftp || config.nemailf || config.forwarders || 0);

    if (isJsonMode()) {
      output('diskUsed', diskUsed);
      output('diskLimit', diskLimit);
      output('bandwidth', { used: bwUsed, limit: bwLimit });
      output('emailAccounts', { used: emailUsed, limit: emailLimit });
      output('domains', { used: domainUsed, limit: domainLimit });
      output('forwarders', { used: fwdUsed, limit: fwdLimit });
      return;
    }

    const lines: string[] = [];

    // Disk Usage
    const diskUsedFmt = formatSize(diskUsed);
    const diskLimitFmt = diskLimit > 0 ? formatSize(diskLimit) : 'unlimited';
    lines.push(theme.keyValue('Disk Usage', `${diskUsedFmt} / ${diskLimitFmt}  ${buildBar(diskUsed, diskLimit)}`));

    // Bandwidth
    const bwUsedFmt = formatSize(bwUsed);
    lines.push(
      theme.keyValue(
        'Bandwidth',
        bwLimit > 0
          ? `${bwUsedFmt} / ${formatSize(bwLimit)}  ${buildBar(bwUsed, bwLimit)}`
          : `${bwUsedFmt} / unlimited`,
      ),
    );

    // Email Accounts
    lines.push(
      theme.keyValue(
        'Email Accounts',
        emailLimit > 0
          ? `${emailUsed} / ${emailLimit}  ${buildBar(emailUsed, emailLimit)}`
          : `${emailUsed} / unlimited`,
      ),
    );

    // Domains
    lines.push(
      theme.keyValue(
        'Domains',
        domainLimit > 0
          ? `${domainUsed} / ${domainLimit}  ${buildBar(domainUsed, domainLimit)}`
          : `${domainUsed} / unlimited`,
      ),
    );

    // Forwarders
    lines.push(
      theme.keyValue(
        'Forwarders',
        fwdLimit > 0 ? `${fwdUsed} / ${fwdLimit}  ${buildBar(fwdUsed, fwdLimit)}` : `${fwdUsed} / unlimited`,
      ),
    );

    console.log(theme.box(lines.join('\n'), 'Resource Usage'));
    console.log('');
  } catch (err: any) {
    spinner?.fail(chalk.red('Failed to fetch quota information'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function quotaSet(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Set Email Quota on ${targetDomain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    spinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No email accounts found.\n'));
      return;
    }

    const { user } = await inquirer.prompt([
      {
        type: 'list',
        name: 'user',
        message: 'Select account:',
        choices: accounts.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
      },
    ]);

    const { quota } = await inquirer.prompt([
      {
        type: 'input',
        name: 'quota',
        message: theme.secondary('New quota in MB (0 = unlimited):'),
        default: '0',
        validate: (input: string) => {
          const num = Number(input);
          if (isNaN(num)) return 'Must be a number';
          if (num < 0) return 'Quota cannot be negative';
          return true;
        },
      },
    ]);

    const quotaNum = Number(quota);
    const quotaLabel = quotaNum === 0 ? 'unlimited' : `${quotaNum} MB`;

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Set quota for ${user}@${targetDomain} to ${quotaLabel}?`,
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const setSpinner = ora({ text: 'Updating quota...', spinner: 'dots12', color: 'cyan' }).start();
    const result = await changeEmailQuota(creds, targetDomain, user, quotaNum);

    if (result.error && result.error !== '0') {
      setSpinner.fail(chalk.red('Failed to update quota'));
      console.log(
        theme.error(`  ${result.text || result.details || 'Unknown error — check credentials and try again'}\n`),
      );
    } else {
      setSpinner.succeed(chalk.green(`Quota updated for ${user}@${targetDomain}`));
      console.log('');
      console.log(
        theme.box(
          [theme.keyValue('Account', `${user}@${targetDomain}`, 0), theme.keyValue('Quota', quotaLabel, 0)].join('\n'),
          'Quota Updated',
        ),
      );
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
