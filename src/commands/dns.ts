import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { runFullDnsCheck } from '../utils/dns';
import { isJsonMode, output, outputError } from '../utils/json-output';

export async function dnsCheck(domain?: string): Promise<void> {
  const config = getConfig();
  const targetDomain = domain || config.domain;
  const server = config.server;

  if (!targetDomain) {
    if (isJsonMode()) {
      outputError('MISSING_ARG', 'domain argument required');
      return;
    }
    const res = await inquirer.prompt([
      {
        type: 'input',
        name: 'domain',
        message: theme.secondary('Domain to check:'),
        validate: (input: string) => (input.includes('.') ? true : 'Enter a valid domain'),
      },
    ]);
    return dnsCheck(res.domain);
  }

  if (!server) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} Server not configured. Run ${theme.bold('mxroute config setup')} first.\n`,
      ),
    );
    process.exit(1);
  }

  if (!isJsonMode()) console.log(theme.heading(`DNS Health Check: ${targetDomain}`));

  const spinner = isJsonMode()
    ? null
    : ora({
        text: `Checking DNS records for ${targetDomain}...`,
        spinner: 'dots12',
        color: 'cyan',
      }).start();

  try {
    const results = await runFullDnsCheck(targetDomain, server);
    spinner?.stop();

    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const warned = results.filter((r) => r.status === 'warn').length;

    if (isJsonMode()) {
      output('domain', targetDomain);
      output('passed', passed);
      output('total', results.length);
      output('checks', results);
      return;
    }

    console.log('');
    for (const result of results) {
      const icon = theme.statusIcon(result.status);
      const typeLabel = theme.bold(result.type.padEnd(6));
      const statusColor =
        result.status === 'pass' ? theme.success : result.status === 'fail' ? theme.error : theme.warning;

      console.log(`  ${icon} ${typeLabel} ${statusColor(result.message)}`);
      if (result.status !== 'pass') {
        console.log(theme.muted(`           Expected: ${result.expected}`));
        console.log(theme.muted(`           Found:    ${result.actual}`));
      }
      console.log('');
    }

    console.log(theme.separator());
    const scoreColor = failed === 0 ? theme.success : failed <= 1 ? theme.warning : theme.error;
    console.log(
      `\n  ${scoreColor(`${passed}/${results.length} checks passed`)}  ${failed > 0 ? theme.error(`${failed} failed`) : ''}  ${warned > 0 ? theme.warning(`${warned} warnings`) : ''}\n`,
    );

    if (failed > 0 || warned > 0) {
      console.log(
        theme.info(
          `  ${theme.statusIcon('info')} Run ${theme.bold('mxroute dns records')} to see required DNS records\n`,
        ),
      );
    }
  } catch (err: any) {
    spinner?.fail('DNS check failed');
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function dnsRecords(domain?: string): Promise<void> {
  const config = getConfig();
  let targetDomain = domain || config.domain;
  const server = config.server;

  if (!server) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} Server not configured. Run ${theme.bold('mxroute config setup')} first.\n`,
      ),
    );
    process.exit(1);
  }

  if (!targetDomain) {
    const res = await inquirer.prompt([
      {
        type: 'input',
        name: 'domain',
        message: theme.secondary('Domain:'),
        validate: (input: string) => (input.includes('.') ? true : 'Enter a valid domain'),
      },
    ]);
    targetDomain = res.domain;
  }

  console.log(theme.heading(`DNS Records: ${targetDomain}`));

  // Fetch live DNS status
  const spinner = ora({ text: 'Checking live DNS...', spinner: 'dots12', color: 'cyan' }).start();

  let mxResult: any, spfResult: any, dkimResult: any, dmarcResult: any;
  try {
    const { checkMxRecords, checkSpfRecord, checkDkimRecord, checkDmarcRecord } = await import('../utils/dns');
    [mxResult, spfResult, dkimResult, dmarcResult] = await Promise.all([
      checkMxRecords(targetDomain!, server),
      checkSpfRecord(targetDomain!),
      checkDkimRecord(targetDomain!),
      checkDmarcRecord(targetDomain!),
    ]);
    spinner.stop();
  } catch {
    spinner.stop();
    // Fall back to showing records without status if DNS check fails
    mxResult = spfResult = dkimResult = dmarcResult = null;
  }

  // Try to fetch real DKIM key
  let dkimValue = '';
  if (config.daUsername && config.daLoginKey) {
    try {
      const { getDkimKey } = await import('../utils/directadmin');
      const key = await getDkimKey(
        { server: config.server, username: config.daUsername, loginKey: config.daLoginKey },
        targetDomain!,
      );
      if (key) dkimValue = key;
    } catch {
      /* skip */
    }
  }

  // Helper to show status
  const statusLine = (status: string | null, type: string, name: string, value: string, priority?: number) => {
    let icon = '  ';
    if (status === 'pass') icon = theme.statusIcon('pass');
    else if (status === 'fail') icon = theme.statusIcon('fail');
    else if (status === 'warn') icon = theme.statusIcon('warn');
    else icon = theme.statusIcon('info');

    const t = chalk.hex('#FFD600').bold(type.padEnd(6));
    const n = chalk.white(name.padEnd(20));
    const p = priority !== undefined ? chalk.hex('#7C8DB0')(`(pri: ${priority}) `.padEnd(12)) : '            ';
    const v = chalk.hex('#00E676')(value);
    return `  ${icon} ${t} ${n} ${p} ${v}`;
  };

  // MX Records
  console.log(theme.subheading('MX Records (required)'));
  console.log(statusLine(mxResult?.status || null, 'MX', '@', `${server}.mxrouting.net`, 10));
  console.log(
    statusLine(
      mxResult?.status === 'pass' || mxResult?.status === 'warn' ? mxResult.status : 'fail',
      'MX',
      '@',
      `${server}-relay.mxrouting.net`,
      20,
    ),
  );
  if (mxResult?.status === 'fail') {
    console.log(theme.error(`         ${mxResult.message}`));
  }

  // SPF
  console.log('');
  console.log(theme.subheading('SPF Record (required)'));
  console.log(statusLine(spfResult?.status || null, 'TXT', '@', 'v=spf1 include:mxroute.com -all'));
  if (spfResult?.status === 'fail') {
    console.log(theme.error(`         ${spfResult.message}`));
  } else if (spfResult?.status === 'warn') {
    console.log(theme.warning(`         ${spfResult.message}`));
  }

  // DKIM
  console.log('');
  console.log(theme.subheading('DKIM Record (required)'));
  if (dkimValue) {
    const displayValue = dkimValue.length > 60 ? dkimValue.substring(0, 57) + '...' : dkimValue;
    console.log(statusLine(dkimResult?.status || null, 'TXT', 'x._domainkey', displayValue));
  } else {
    console.log(statusLine('fail', 'TXT', 'x._domainkey', 'MISSING — run: mxroute dns dkim ' + targetDomain));
  }
  if (dkimResult?.status === 'fail') {
    console.log(theme.error(`         ${dkimResult.message}`));
  }

  // DMARC
  console.log('');
  console.log(theme.subheading('DMARC Record (recommended)'));
  const dmarcValue = `v=DMARC1; p=quarantine; rua=mailto:postmaster@${targetDomain}`;
  console.log(statusLine(dmarcResult?.status || null, 'TXT', '_dmarc', dmarcValue));
  if (dmarcResult?.status === 'warn') {
    console.log(theme.warning(`         ${dmarcResult.message}`));
  } else if (dmarcResult?.status === 'fail') {
    console.log(theme.muted(`         Not configured — recommended for spam protection`));
  }

  // Custom Hostnames (optional, no live check here)
  console.log('');
  console.log(theme.subheading('Custom Hostnames (optional)'));
  console.log(theme.record('CNAME', 'mail', `${server}.mxrouting.net`));
  console.log(theme.record('CNAME', 'webmail', `${server}.mxrouting.net`));

  console.log('');
  if (mxResult && spfResult && dkimResult && dmarcResult) {
    const allPass = [mxResult, spfResult, dkimResult, dmarcResult].every((r: any) => r.status === 'pass');
    if (allPass) {
      console.log(theme.success(`  ${theme.statusIcon('pass')} All required DNS records are correctly configured!\n`));
    } else {
      const missing = [mxResult, spfResult, dkimResult, dmarcResult].filter((r: any) => r.status === 'fail').length;
      const warnings = [mxResult, spfResult, dkimResult, dmarcResult].filter((r: any) => r.status === 'warn').length;
      if (missing > 0) console.log(theme.error(`  ${missing} record${missing > 1 ? 's' : ''} missing or incorrect`));
      if (warnings > 0) console.log(theme.warning(`  ${warnings} warning${warnings > 1 ? 's' : ''}`));
      console.log(
        theme.muted(
          `\n  Fix with: ${theme.bold('mxroute fix')} or ${theme.bold('mxroute dns setup ' + targetDomain)}\n`,
        ),
      );
    }
  } else {
    console.log(theme.muted('  ℹ DKIM key is unique per domain — get via: mxroute dns dkim'));
    console.log(theme.muted('  ℹ Only ONE SPF record per domain — merge if you have other senders'));
    console.log(theme.muted('  ℹ Use CNAME (not A records) for custom hostnames — IPs may change\n'));
  }
}

export async function dnsGenerate(domain?: string): Promise<void> {
  const config = getConfig();
  let targetDomain = domain || config.domain;
  const server = config.server;

  if (!server) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} Server not configured. Run ${theme.bold('mxroute config setup')} first.\n`,
      ),
    );
    process.exit(1);
  }

  if (!targetDomain) {
    const res = await inquirer.prompt([
      {
        type: 'input',
        name: 'domain',
        message: theme.secondary('Domain:'),
        validate: (input: string) => (input.includes('.') ? true : 'Enter a valid domain'),
      },
    ]);
    targetDomain = res.domain;
  }

  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'DNS Provider:',
      choices: [
        { name: 'Cloudflare', value: 'cloudflare' },
        { name: 'Namecheap', value: 'namecheap' },
        { name: 'Route53 (AWS)', value: 'route53' },
        { name: 'Generic / Other', value: 'generic' },
      ],
    },
  ]);

  const { includeCustom } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'includeCustom',
      message: 'Include custom hostname records (mail.domain, webmail.domain)?',
      default: false,
    },
  ]);

  console.log(theme.heading(`DNS Records for ${targetDomain}`));

  if (provider === 'cloudflare') {
    console.log(
      theme.warning(`  ${theme.statusIcon('warn')} Cloudflare: Proxy (orange cloud) must be OFF for mail records!\n`),
    );
  }

  // Zone file format
  console.log(theme.subheading('Zone File / Bind Format'));
  console.log(theme.muted('  Copy these records to your DNS provider:\n'));

  const records = [
    `; MX Records`,
    `${targetDomain}.    IN  MX  10  ${server}.mxrouting.net.`,
    `${targetDomain}.    IN  MX  20  ${server}-relay.mxrouting.net.`,
    ``,
    `; SPF Record`,
    `${targetDomain}.    IN  TXT "v=spf1 include:mxroute.com -all"`,
    ``,
    `; DKIM Record`,
    `x._domainkey.${targetDomain}.    IN  TXT "(paste DKIM key from Control Panel)"`,
    ``,
    `; DMARC Record`,
    `_dmarc.${targetDomain}.    IN  TXT "v=DMARC1; p=quarantine; rua=mailto:postmaster@${targetDomain}"`,
  ];

  if (includeCustom) {
    records.push(
      ``,
      `; Custom Hostnames`,
      `mail.${targetDomain}.      IN  CNAME  ${server}.mxrouting.net.`,
      `webmail.${targetDomain}.   IN  CNAME  ${server}.mxrouting.net.`,
    );
  }

  console.log(records.map((r) => `    ${theme.muted(r)}`).join('\n'));
  console.log('');

  if (provider === 'route53') {
    console.log(theme.info(`  ${theme.statusIcon('info')} Route53: Wrap TXT values in double quotes\n`));
  }

  console.log(
    theme.info(`  ${theme.statusIcon('info')} After adding records, verify with: ${theme.bold('mxroute dns check')}\n`),
  );
}
