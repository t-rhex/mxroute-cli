import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { runFullDnsCheck } from '../utils/dns';
import { testConnection } from '../utils/api';

export async function troubleshootCommand(): Promise<void> {
  console.log(theme.heading('Troubleshoot MXroute'));

  const { issue } = await inquirer.prompt([
    {
      type: 'list',
      name: 'issue',
      message: 'What issue are you experiencing?',
      choices: [
        { name: 'Emails going to spam (Gmail)', value: 'spam-gmail' },
        { name: 'Emails going to spam (Microsoft/Hotmail/Outlook)', value: 'spam-microsoft' },
        { name: 'Cannot connect to server', value: 'connection' },
        { name: 'Authentication failures', value: 'auth' },
        { name: 'Emails not being delivered', value: 'delivery' },
        { name: 'DNS configuration issues', value: 'dns' },
        { name: 'SSL certificate warnings', value: 'ssl' },
        { name: 'Common error messages', value: 'errors' },
        { name: 'Migration issues', value: 'migration' },
        { name: 'Spam filter blocking legitimate mail', value: 'spam-filter' },
      ],
    },
  ]);

  console.log('');

  switch (issue) {
    case 'spam-gmail':
      printSpamGmail();
      break;
    case 'spam-microsoft':
      printSpamMicrosoft();
      break;
    case 'connection':
      await troubleshootConnection();
      break;
    case 'auth':
      printAuthIssues();
      break;
    case 'delivery':
      await troubleshootDelivery();
      break;
    case 'dns':
      await troubleshootDns();
      break;
    case 'ssl':
      printSslIssues();
      break;
    case 'errors':
      printCommonErrors();
      break;
    case 'migration':
      printMigrationHelp();
      break;
    case 'spam-filter':
      printSpamFilterHelp();
      break;
  }
}

function printSpamGmail(): void {
  console.log(theme.heading('Fixing Gmail Spam Issues'));

  const steps = [
    [
      'Step 1',
      'Get 10/10 on mail-tester.com',
      'Send a test email to the address shown on mail-tester.com and check your score',
    ],
    ['Step 2', 'Verify DNS records', 'Run: mxroute dns check — all SPF, DKIM, DMARC must pass'],
    [
      'Step 3',
      'Train Gmail filters',
      'Ask recipients to:\n           - Mark messages as "Not spam"\n           - Add your address to contacts\n           - Reply to and engage with your emails',
    ],
    ['Step 4', 'Monitor reputation', 'Set up Google Postmaster Tools to track domain reputation'],
    [
      'Step 5',
      'Content quality',
      'Avoid spam trigger words, maintain good text-to-image ratio,\n           build volume gradually for new domains',
    ],
  ];

  for (const [step, title, desc] of steps) {
    console.log(`  ${theme.secondary(step)}  ${theme.bold(title)}`);
    console.log(`           ${theme.muted(desc)}`);
    console.log('');
  }

  console.log(
    theme.info(
      `  ${theme.statusIcon('info')} Gmail requirements: SPF + DKIM auth, <0.1% spam rate, consistent patterns\n`,
    ),
  );
}

function printSpamMicrosoft(): void {
  console.log(theme.heading('Fixing Microsoft Spam Issues'));
  console.log(
    theme.warning(`  ${theme.statusIcon('warn')} Microsoft has notoriously strict filtering. This is industry-wide.\n`),
  );

  const steps = [
    ['Step 1', 'Get 10/10 on mail-tester.com'],
    ['Step 2', 'Verify all DNS records: mxroute dns check'],
    ['Step 3', 'Ask recipients to mark as "Not Junk" (use the button)'],
    ['Step 4', 'Ask recipients to add your address to contacts'],
    ['Step 5', 'Use natural person-to-person communication style'],
    ['Step 6', 'Avoid sending many emails at once'],
  ];

  for (const [step, action] of steps) {
    console.log(`  ${theme.secondary(step)}  ${theme.muted(action)}`);
  }

  console.log('');
  console.log(theme.info(`  ${theme.statusIcon('info')} MXroute manages server IP reputation via Microsoft SNDS`));
  console.log(
    theme.info(
      `  ${theme.statusIcon('info')} If issues persist: open support ticket with mail-tester score and headers\n`,
    ),
  );
}

async function troubleshootConnection(): Promise<void> {
  console.log(theme.heading('Connection Troubleshooting'));

  const config = getConfig();

  console.log(theme.subheading('Checklist'));
  console.log(theme.muted('    1. Verify server hostname (found in Control Panel -> DNS)'));
  console.log(theme.muted('    2. Try these ports:'));
  console.log(theme.keyValue('IMAP', '993 (SSL) or 143 (STARTTLS)', 7));
  console.log(theme.keyValue('SMTP', '465 (SSL), 587 (STARTTLS), or 2525 (STARTTLS)', 7));
  console.log(theme.muted('    3. If port 587 is blocked by ISP, try port 2525'));
  console.log(theme.muted('    4. Check internet connectivity and firewall'));
  console.log(theme.muted('    5. Verify date/time is correct on your device'));
  console.log('');

  if (config.server && config.username && config.password) {
    const spinner = ora({ text: 'Testing SMTP API connection...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const result = await testConnection(`${config.server}.mxrouting.net`, config.username, config.password);
      if (result.success) {
        spinner.succeed('SMTP API is reachable and credentials are valid');
      } else {
        spinner.fail(`SMTP API error: ${result.message}`);
      }
    } catch (err: any) {
      spinner.fail(`Cannot reach SMTP API: ${err.message}`);
    }
    console.log('');
  }
}

function printAuthIssues(): void {
  console.log(theme.heading('Authentication Troubleshooting'));

  const checks = [
    ['Username', 'Must be the FULL email address (user@domain.com)'],
    ['Password', 'Reset in Control Panel -> Email Accounts if unsure'],
    ['Server', 'Must match your MXroute server (check Control Panel -> DNS)'],
    ['Encryption', 'Ensure SSL/TLS or STARTTLS is enabled (not "None")'],
    ['Test', 'Try logging into webmail first to verify credentials'],
  ];

  for (const [label, desc] of checks) {
    console.log(`  ${theme.statusIcon('info')} ${theme.bold(label.padEnd(12))} ${theme.muted(desc)}`);
  }
  console.log('');
}

async function troubleshootDelivery(): Promise<void> {
  console.log(theme.heading('Email Delivery Troubleshooting'));

  const config = getConfig();

  console.log(theme.subheading('Diagnostic Steps'));
  console.log(theme.muted('    1. Send test email to mail-tester.com — aim for 10/10'));
  console.log(theme.muted('    2. Check DNS records: mxroute dns check'));
  console.log(theme.muted('    3. Verify sender address exists in Control Panel'));
  console.log(theme.muted('    4. Check email headers for bounce/error info'));
  console.log(theme.muted('    5. Verify recipient address is correct'));
  console.log('');

  if (config.domain && config.server) {
    const spinner = ora({ text: 'Checking DNS...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const results = await runFullDnsCheck(config.domain, config.server);
      spinner.stop();
      const failed = results.filter((r) => r.status === 'fail');
      if (failed.length > 0) {
        console.log(theme.error(`  ${theme.statusIcon('fail')} DNS issues found that may affect delivery:\n`));
        for (const f of failed) {
          console.log(`    ${theme.statusIcon('fail')} ${f.type}: ${f.message}`);
        }
      } else {
        console.log(theme.success(`  ${theme.statusIcon('pass')} DNS records look good`));
      }
    } catch {
      spinner.stop();
    }
    console.log('');
  }
}

async function troubleshootDns(): Promise<void> {
  const config = getConfig();
  if (config.domain && config.server) {
    const { dnsCheck } = await import('./dns');
    await dnsCheck(config.domain);
  } else {
    console.log(theme.heading('DNS Troubleshooting'));
    console.log(theme.muted('  Common DNS mistakes:'));
    console.log(theme.muted('    1. Multiple SPF records — only one allowed per domain'));
    console.log(theme.muted('    2. Wrong DKIM selector — must be x._domainkey'));
    console.log(theme.muted('    3. DKIM key truncated by DNS provider'));
    console.log(theme.muted('    4. MX pointing to IP — must be hostname'));
    console.log(theme.muted('    5. Missing relay MX record (priority 20)'));
    console.log(theme.muted('    6. Using A record for custom hostname — use CNAME'));
    console.log(theme.muted('    7. SPF with ~all instead of -all'));
    console.log('');
    console.log(
      theme.info(
        `  ${theme.statusIcon('info')} Configure first: ${theme.bold('mxroute config setup')}, then run ${theme.bold('mxroute dns check')}\n`,
      ),
    );
  }
}

function printSslIssues(): void {
  console.log(theme.heading('SSL Certificate Troubleshooting'));
  console.log(theme.muted('    1. If using custom hostnames, ensure CNAME records are correct'));
  console.log(theme.muted('    2. Request SSL certificate in Control Panel -> SSL Certificates'));
  console.log(theme.muted('    3. Wait for DNS propagation before requesting certificate'));
  console.log(theme.muted('    4. Use CNAME records, not A records (IPs may change)'));
  console.log('');
}

function printCommonErrors(): void {
  console.log(theme.heading('Common Error Messages'));

  const errors: [string, string, string][] = [
    [
      '550 Authentication Required',
      'SMTP auth not enabled in email client',
      'Enable SMTP authentication with full email as username',
    ],
    [
      'Sender Verify Failed',
      'FROM address does not exist on server',
      'Ensure sending address exists and matches authenticated account',
    ],
    ['550 5.7.515 Access Denied', 'Microsoft rejecting due to failed auth', 'Check DKIM record — most common cause'],
    [
      'No Such Recipient Here',
      'Recipient does not exist on server',
      'Verify account exists in Control Panel -> Email Accounts',
    ],
    ['Address Blocked by Admins', 'Policy violation or abuse', 'Contact MXroute support with details'],
  ];

  for (const [error, cause, fix] of errors) {
    console.log(`  ${theme.error(error)}`);
    console.log(`    ${theme.label('Cause:')} ${theme.muted(cause)}`);
    console.log(`    ${theme.label('Fix:')}   ${theme.muted(fix)}`);
    console.log('');
  }
}

function printMigrationHelp(): void {
  console.log(theme.heading('Email Migration'));

  console.log(theme.subheading('Using imapsync'));
  console.log('');
  console.log(theme.muted('    imapsync \\'));
  console.log(theme.muted('      --host1 source.server.com --user1 source@example.com \\'));
  console.log(theme.muted("      --password1 'sourcepass' \\"));
  console.log(theme.muted('      --host2 mail.mxroute.com --user2 dest@example.com \\'));
  console.log(theme.muted("      --password2 'destpass'"));
  console.log('');

  console.log(theme.subheading('Migration Steps'));
  console.log(theme.muted('    1. Create destination accounts on MXroute first'));
  console.log(theme.muted('    2. Test with a non-critical account'));
  console.log(theme.muted('    3. Run imapsync during low-usage hours'));
  console.log(theme.muted('    4. Verify emails transferred'));
  console.log(theme.muted('    5. Update DNS MX records to MXroute'));
  console.log(theme.muted('    6. Configure SPF, DKIM, DMARC'));
  console.log(theme.muted('    7. Reconfigure all devices'));
  console.log(theme.muted('    8. Keep old service running during transition'));
  console.log('');

  console.log(theme.subheading('Common Issues'));
  console.log(theme.keyValue('Timeouts', 'Check firewall and IMAP access on source'));
  console.log(theme.keyValue('Missing emails', 'Verify folder structures; use mapping options'));
  console.log(theme.keyValue('Auth failures', 'Confirm credentials; ensure IMAP enabled'));
  console.log(theme.keyValue('Slow transfer', 'Split large mailboxes into batches'));
  console.log('');
}

function printSpamFilterHelp(): void {
  console.log(theme.heading('Expert Spam Filtering'));
  console.log(theme.muted('  MXroute Expert Spam Filtering is enabled by default.'));
  console.log('');
  console.log(theme.subheading('Managing the Filter'));
  console.log(theme.muted('    Toggle: Management Panel -> Login to Panel -> Spam Filters -> Advanced'));
  console.log(theme.muted('    Changes take effect within 5 minutes'));
  console.log('');
  console.log(
    theme.warning(
      `  ${theme.statusIcon('warn')} Cannot disable if forwarding to Gmail, Microsoft, Yahoo, AOL, or T-Online`,
    ),
  );
  console.log('');
  console.log(theme.subheading('If Legitimate Mail is Blocked'));
  console.log(theme.muted('    Submit whitelist request: https://whitelistrequest.mxrouting.net'));
  console.log('');
  console.log(theme.subheading('When to Contact Support'));
  console.log(theme.muted('    Include: error message, timestamp, mail-tester score, affected domain,'));
  console.log(theme.muted('    email headers, and steps already attempted.'));
  console.log(theme.muted('    Response time: typically 4-6 hours, within 24 hours.'));
  console.log('');
}
