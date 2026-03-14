import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { runFullDnsCheck, DnsCheckResult } from '../utils/dns';

export async function dnsCheck(domain?: string): Promise<void> {
  const config = getConfig();
  const targetDomain = domain || config.domain;
  const server = config.server;

  if (!targetDomain) {
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

  console.log(theme.heading(`DNS Health Check: ${targetDomain}`));

  const spinner = ora({
    text: `Checking DNS records for ${targetDomain}...`,
    spinner: 'dots12',
    color: 'cyan',
  }).start();

  try {
    const results = await runFullDnsCheck(targetDomain, server);
    spinner.stop();

    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const warned = results.filter((r) => r.status === 'warn').length;

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
    spinner.fail('DNS check failed');
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function dnsRecords(domain?: string): Promise<void> {
  const config = getConfig();
  const targetDomain = domain || config.domain;
  const server = config.server;

  if (!targetDomain || !server) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} Configure domain and server first: ${theme.bold('mxroute config setup')}\n`,
      ),
    );
    process.exit(1);
  }

  console.log(theme.heading(`Required DNS Records: ${targetDomain}`));

  console.log(theme.subheading('MX Records (required)'));
  console.log(theme.record('MX', '@', `${server}.mxrouting.net`, 10));
  console.log(theme.record('MX', '@', `${server}-relay.mxrouting.net`, 20));

  console.log('');
  console.log(theme.subheading('SPF Record (required)'));
  console.log(theme.record('TXT', '@', `v=spf1 include:mxroute.com -all`));

  console.log('');
  console.log(theme.subheading('DKIM Record (required)'));
  console.log(theme.record('TXT', 'x._domainkey', `(copy from Control Panel → DNS → ${targetDomain})`));

  console.log('');
  console.log(theme.subheading('DMARC Record (recommended)'));
  console.log(theme.record('TXT', '_dmarc', `v=DMARC1; p=quarantine; rua=mailto:postmaster@${targetDomain}`));

  console.log('');
  console.log(theme.subheading('Custom Hostnames (optional)'));
  console.log(theme.record('CNAME', 'mail', `${server}.mxrouting.net`));
  console.log(theme.record('CNAME', 'webmail', `${server}.mxrouting.net`));

  console.log('');
  console.log(
    theme.muted(`  ${theme.statusIcon('info')} DKIM key is unique per domain — copy from Control Panel → DNS`),
  );
  console.log(
    theme.muted(`  ${theme.statusIcon('info')} Only ONE SPF record per domain — merge if you have other senders`),
  );
  console.log(
    theme.muted(`  ${theme.statusIcon('info')} Use CNAME (not A records) for custom hostnames — IPs may change`),
  );
  console.log('');
}

export async function dnsGenerate(domain?: string): Promise<void> {
  const config = getConfig();
  const targetDomain = domain || config.domain;
  const server = config.server;

  if (!targetDomain || !server) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} Configure domain and server first: ${theme.bold('mxroute config setup')}\n`,
      ),
    );
    process.exit(1);
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
