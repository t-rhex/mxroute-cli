import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import {
  getQuotaUsage,
  getUserConfig,
  listDomains,
  listEmailAccounts,
  changeEmailQuota,
  DACredentials,
} from '../utils/directadmin';

function getCreds(): DACredentials {
  const config = getConfig();
  if (!config.daUsername || !config.daLoginKey) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} Not authenticated. Run ${theme.bold('mxroute auth login')} first.\n`,
      ),
    );
    process.exit(1);
  }
  return { server: config.server, username: config.daUsername, loginKey: config.daLoginKey };
}

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

  console.log(theme.heading('Account Quota Overview'));

  const spinner = ora({ text: 'Fetching quota information...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const [usage, config] = await Promise.all([getQuotaUsage(creds), getUserConfig(creds)]);
    spinner.stop();

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
    spinner.fail(chalk.red('Failed to fetch quota information'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function quotaSet(domain?: string): Promise<void> {
  const creds = getCreds();

  // Pick domain
  if (!domain) {
    const config = getConfig();
    if (config.domain) {
      domain = config.domain;
    } else {
      const domSpinner = ora({ text: 'Fetching domains...', spinner: 'dots12', color: 'cyan' }).start();
      const domains = await listDomains(creds);
      domSpinner.stop();

      if (domains.length === 0) {
        console.log(theme.error(`\n  ${theme.statusIcon('fail')} No domains found on this account.\n`));
        process.exit(1);
      }

      if (domains.length === 1) {
        domain = domains[0];
      } else {
        const { selected } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selected',
            message: 'Select domain:',
            choices: domains,
          },
        ]);
        domain = selected;
      }
    }
  }

  console.log(theme.heading(`Set Email Quota on ${domain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, domain!);
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
        choices: accounts.map((a) => ({ name: `${a}@${domain}`, value: a })),
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
        message: `Set quota for ${user}@${domain} to ${quotaLabel}?`,
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const setSpinner = ora({ text: 'Updating quota...', spinner: 'dots12', color: 'cyan' }).start();
    const result = await changeEmailQuota(creds, domain!, user, quotaNum);

    if (result.error && result.error !== '0') {
      setSpinner.fail(chalk.red('Failed to update quota'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      setSpinner.succeed(chalk.green(`Quota updated for ${user}@${domain}`));
      console.log('');
      console.log(
        theme.box(
          [theme.keyValue('Account', `${user}@${domain}`, 0), theme.keyValue('Quota', quotaLabel, 0)].join('\n'),
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
