import chalk from 'chalk';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';

export async function infoCommand(section?: string): Promise<void> {
  const config = getConfig();
  const server = config.server ? `${config.server}.mxrouting.net` : '(your-server).mxrouting.net';

  if (!section || section === 'connections' || section === 'all') {
    console.log(theme.heading('Email Client Connection Settings'));

    console.log(theme.subheading('Server'));
    console.log(theme.keyValue('Hostname', server));
    console.log(theme.keyValue('Username', 'Your full email address'));
    console.log(theme.keyValue('Password', 'Your email account password'));
    console.log('');

    const table = new Table({
      head: [
        chalk.hex('#6C63FF')('Protocol'),
        chalk.hex('#6C63FF')('Port'),
        chalk.hex('#6C63FF')('Encryption'),
        chalk.hex('#6C63FF')('Usage'),
      ],
      style: { head: [], border: ['gray'] },
      chars: {
        top: '─',
        'top-mid': '┬',
        'top-left': '  ┌',
        'top-right': '┐',
        bottom: '─',
        'bottom-mid': '┴',
        'bottom-left': '  └',
        'bottom-right': '┘',
        left: '  │',
        'left-mid': '  ├',
        mid: '─',
        'mid-mid': '┼',
        right: '│',
        'right-mid': '┤',
        middle: '│',
      },
    });

    table.push(
      [chalk.cyan('IMAP'), chalk.white.bold('993'), chalk.green('SSL/TLS'), 'Recommended'],
      [chalk.cyan('IMAP'), chalk.white('143'), chalk.yellow('STARTTLS'), 'Alternative'],
      [chalk.cyan('POP3'), chalk.white.bold('995'), chalk.green('SSL/TLS'), 'Recommended'],
      [chalk.cyan('POP3'), chalk.white('110'), chalk.yellow('STARTTLS'), 'Alternative'],
      [chalk.cyan('SMTP'), chalk.white.bold('465'), chalk.green('SSL/TLS'), 'Recommended'],
      [chalk.cyan('SMTP'), chalk.white('587'), chalk.yellow('STARTTLS'), 'Alternative'],
      [chalk.cyan('SMTP'), chalk.white('2525'), chalk.yellow('STARTTLS'), 'If 587 blocked'],
    );

    console.log(table.toString());
    console.log('');
  }

  if (!section || section === 'webmail' || section === 'all') {
    console.log(theme.heading('Webmail Access'));
    console.log(theme.keyValue('Crossbox', `https://${server}/crossbox`));
    console.log(theme.keyValue('Roundcube', `https://${server}/roundcube`));
    if (config.domain) {
      console.log(theme.keyValue('Custom', `https://webmail.${config.domain} (if configured)`));
    }
    console.log('');
  }

  if (!section || section === 'caldav' || section === 'all') {
    console.log(theme.heading('CalDAV & CardDAV'));
    console.log(theme.keyValue('Server', 'dav.mxroute.com'));
    console.log(theme.keyValue('Port', '443 (HTTPS)'));
    console.log(theme.keyValue('Username', 'Full email address'));
    console.log(theme.keyValue('URL', 'https://dav.mxroute.com'));
    console.log('');

    console.log(theme.subheading('Platform Setup'));
    console.log(theme.muted('    iOS/iPadOS   Settings → Calendar/Contacts → Add CalDAV Account'));
    console.log(theme.muted('    macOS        Calendar app → Add Account → Other → Manual'));
    console.log(theme.muted('    Android      Install DAVx5 → Base URL: https://dav.mxroute.com'));
    console.log(theme.muted('    Thunderbird  Calendar → New Calendar → On the Network'));
    console.log('');
  }

  if (!section || section === 'smtp-api' || section === 'all') {
    console.log(theme.heading('SMTP API'));
    console.log(theme.keyValue('Endpoint', 'https://smtpapi.mxroute.com/'));
    console.log(theme.keyValue('Method', 'POST'));
    console.log(theme.keyValue('Content-Type', 'application/json'));
    console.log(theme.keyValue('Rate Limit', '400 emails/hour per address'));
    console.log('');
    console.log(theme.subheading('Required Fields'));
    console.log(theme.muted('    server, username, password, from, to, subject, body'));
    console.log('');
    console.log(theme.subheading('Limitations'));
    console.log(theme.muted('    • Single recipient per request'));
    console.log(theme.muted('    • No file attachments'));
    console.log(theme.muted('    • Body size limit: ~10MB'));
    console.log(theme.muted('    • No marketing/promotional emails'));
    console.log('');
  }

  if (!section || section === 'limits' || section === 'all') {
    console.log(theme.heading('Service Limits'));
    console.log(theme.keyValue('Outbound', '400 emails/hour per email address'));
    console.log(theme.keyValue('Marketing', chalk.red.bold('NOT ALLOWED') + ' — instant suspension'));
    console.log(theme.keyValue('Allowed', 'Business, transactional, personal email'));
    console.log(theme.keyValue('Support', 'Ticket-based, 4-6 hour response'));
    console.log(theme.keyValue('SLA', 'None (but high reliability)'));
    console.log('');
  }

  if (!section || section === 'panels' || section === 'all') {
    console.log(theme.heading('Management Panels'));
    console.log(theme.keyValue('Management', 'https://management.mxroute.com'));
    console.log(theme.muted('      Subscriptions, invoices, payment, support tickets'));
    console.log(theme.keyValue('Control', 'https://panel.mxroute.com'));
    console.log(theme.muted('      Email accounts, forwarders, domains, DNS, spam, webmail'));
    console.log(theme.keyValue('Whitelist', 'https://whitelistrequest.mxrouting.net'));
    console.log(theme.muted('      Request IP/domain whitelist for spam filter'));
    console.log('');
  }
}

export async function clientSetup(client?: string): Promise<void> {
  const config = getConfig();
  const server = config.server ? `${config.server}.mxrouting.net` : '(your-server).mxrouting.net';

  if (!client) {
    console.log(theme.heading('Email Client Setup Guides'));
    console.log(theme.muted('  Use: mxroute info client <name>\n'));
    console.log(theme.keyValue('ios', 'Apple Mail (iPhone/iPad)'));
    console.log(theme.keyValue('outlook', 'Microsoft Outlook'));
    console.log(theme.keyValue('thunderbird', 'Mozilla Thunderbird'));
    console.log(theme.keyValue('generic', 'Generic IMAP/SMTP setup'));
    console.log('');
    return;
  }

  switch (client.toLowerCase()) {
    case 'ios':
    case 'apple':
      console.log(theme.heading('iOS Mail Setup'));
      console.log(theme.muted('    1. Settings → Mail → Accounts → Add Account → Other'));
      console.log(theme.muted('    2. Add Mail Account'));
      console.log(theme.muted('    3. Enter name, email, password'));
      console.log(theme.muted('    4. Select IMAP'));
      console.log(theme.keyValue('Incoming', `${server}, port 993, SSL ON`, 4));
      console.log(theme.keyValue('Outgoing', `${server}, port 465, SSL ON`, 4));
      console.log(theme.muted('    5. Authentication: Password'));
      console.log(theme.muted('    6. Enable Mail only (disable Contacts, Calendars, Notes)'));
      break;
    case 'outlook':
      console.log(theme.heading('Outlook Setup'));
      console.log(theme.muted('    1. File → Add Account (Windows) / Tools → Accounts (Mac)'));
      console.log(theme.muted('    2. Advanced/Manual setup → IMAP'));
      console.log(theme.keyValue('Incoming', `${server}, port 993, SSL/TLS`, 4));
      console.log(theme.keyValue('Outgoing', `${server}, port 465, SSL/TLS`, 4));
      console.log(theme.muted('    3. Username: full email address'));
      break;
    case 'thunderbird':
      console.log(theme.heading('Thunderbird Setup'));
      console.log(theme.muted('    1. Account Settings → Add Mail Account'));
      console.log(theme.muted('    2. Enter credentials → Manual config'));
      console.log(theme.keyValue('IMAP', `${server}, port 993, SSL/TLS`, 4));
      console.log(theme.keyValue('SMTP', `${server}, port 465, SSL/TLS`, 4));
      break;
    default:
      console.log(theme.heading('Generic Email Client Setup'));
      console.log(theme.keyValue('Server', server, 4));
      console.log(theme.keyValue('IMAP Port', '993 (SSL/TLS)', 4));
      console.log(theme.keyValue('SMTP Port', '465 (SSL/TLS)', 4));
      console.log(theme.keyValue('Username', 'Full email address', 4));
      console.log(theme.keyValue('Auth', 'Password', 4));
  }
  console.log('');
}
