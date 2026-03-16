#!/usr/bin/env node

process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name !== 'DeprecationWarning') console.warn(w);
});

import { Command } from 'commander';
import { theme } from './utils/theme';
import { setJsonMode, flush } from './utils/json-output';

const pkg = require('../package.json');

const program = new Command();

program
  .name('mxroute')
  .description('A powerful CLI for managing MXroute email hosting')
  .version(pkg.version, '-v, --version')
  .addHelpText('beforeAll', theme.banner())
  .addHelpText(
    'afterAll',
    `
  ─── Quick Reference ──────────────────────────────────────
  Core:        setup, status, config, auth, whoami, open
  Email:       accounts, forwarders, autoresponder, catchall, filters, lists, aliases
  Mail:        mail inbox, mail read, mail compose, mail reply, mail search
  DNS:         dns check, dns setup, dns providers, dns list, dns add
  Sending:     send, test, webhook, templates
  Security:    audit, spam, ip, reputation, ssl-check
  Monitoring:  monitor, doctor, benchmark, cron, rate-limit
  Data:        export, import, diff, bulk, mail-backup, migrate
  Business:    onboard, provision, deprovision, welcome-send, quota-policy
  Platform:    guide, suggest, playbook, dashboard, completions, report

  Run mxroute guide to explore commands with examples.
`,
  );

program.option('--json', 'Output as JSON (for scripting)');
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  if (opts.json) setJsonMode(true);
});
program.hook('postAction', () => {
  flush();
});

// ─── Setup Wizard ────────────────────────────────────────
program
  .command('setup')
  .description('Interactive setup wizard (CLI, MCP server, skills)')
  .action(async () => {
    const { setupWizard } = await import('./commands/setup');
    await setupWizard();
  });

// ─── Status ──────────────────────────────────────────────
program
  .command('status')
  .description('Show account status, DNS health, and API connectivity')
  .action(async () => {
    const { statusCommand } = await import('./commands/status');
    await statusCommand();
  });

// ─── Config ──────────────────────────────────────────────
const configCmd = program.command('config').description('Manage CLI configuration and profiles');

configCmd
  .command('setup')
  .description('Interactive configuration setup')
  .action(async () => {
    const { configSetup } = await import('./commands/config');
    await configSetup();
  });

configCmd
  .command('sending-account')
  .alias('smtp')
  .description('Configure sending account for email')
  .action(async () => {
    const { configSendingAccount } = await import('./commands/config');
    await configSendingAccount();
  });

configCmd
  .command('remove-sending-account')
  .alias('remove-smtp')
  .description('Remove stored sending account')
  .action(async () => {
    const { configRemoveSendingAccount } = await import('./commands/config');
    await configRemoveSendingAccount();
  });

configCmd
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    const { configShow } = await import('./commands/config');
    await configShow();
  });

configCmd
  .command('profiles')
  .description('List all profiles')
  .action(async () => {
    const { configProfiles } = await import('./commands/config');
    await configProfiles();
  });

configCmd
  .command('switch [name]')
  .description('Switch active profile')
  .action(async (name?: string) => {
    const { configSwitch } = await import('./commands/config');
    await configSwitch(name);
  });

configCmd
  .command('delete [name]')
  .description('Delete a profile')
  .action(async (name?: string) => {
    const { configDelete } = await import('./commands/config');
    await configDelete(name);
  });

// ─── Send ────────────────────────────────────────────────
program
  .command('send')
  .description('Send a quick email (single recipient, no attachments — use mail compose for full features)')
  .option('-t, --to <email>', 'Recipient email address')
  .option('-s, --subject <subject>', 'Email subject')
  .option('-b, --body <body>', 'Email body')
  .option('-f, --from <email>', 'Sender email (defaults to configured username)')
  .option('--html', 'Treat body as raw HTML')
  .option('--file <path>', 'Read body from file')
  .action(async (options) => {
    const { sendCommand } = await import('./commands/send');
    await sendCommand(options);
  });

// ─── DNS ─────────────────────────────────────────────────
const dnsCmd = program.command('dns').description('DNS record management and verification');

dnsCmd
  .command('check [domain]')
  .description('Verify DNS records (MX, SPF, DKIM, DMARC) for one domain')
  .action(async (domain?: string) => {
    const { dnsCheck } = await import('./commands/dns');
    await dnsCheck(domain);
  });

dnsCmd
  .command('records [domain]')
  .description('Show required DNS records')
  .action(async (domain?: string) => {
    const { dnsRecords } = await import('./commands/dns');
    await dnsRecords(domain);
  });

dnsCmd
  .command('generate [domain]')
  .description('Generate DNS records for your provider')
  .action(async (domain?: string) => {
    const { dnsGenerate } = await import('./commands/dns');
    await dnsGenerate(domain);
  });

dnsCmd
  .command('setup [domain]')
  .description('Auto-configure DNS records via registrar API (Cloudflare, Porkbun, etc.)')
  .action(async (domain?: string) => {
    const { dnsSetup } = await import('./commands/dns-setup');
    await dnsSetup(domain);
  });

dnsCmd
  .command('watch [domain]')
  .description('Watch DNS propagation in real-time (re-checks every 15s)')
  .action(async (domain?: string) => {
    const { dnsWatchCommand } = await import('./commands/dns-watch');
    await dnsWatchCommand(domain);
  });

dnsCmd
  .command('providers')
  .description('List supported DNS providers and credential status')
  .action(async () => {
    const { dnsProvidersCommand } = await import('./commands/dns-providers');
    await dnsProvidersCommand();
  });

dnsCmd
  .command('providers-setup <provider>')
  .description('Configure credentials for a DNS provider')
  .action(async (provider: string) => {
    const { dnsProvidersSetup } = await import('./commands/dns-providers');
    await dnsProvidersSetup(provider);
  });

dnsCmd
  .command('providers-remove <provider>')
  .description('Remove credentials for a DNS provider')
  .action(async (provider: string) => {
    const { dnsProvidersRemove } = await import('./commands/dns-providers');
    await dnsProvidersRemove(provider);
  });

dnsCmd
  .command('list [domain]')
  .alias('ls')
  .description('List all DNS records from server')
  .action(async (domain?: string) => {
    const { dnsapiList } = await import('./commands/dnsapi');
    await dnsapiList(domain);
  });

dnsCmd
  .command('add [domain]')
  .description('Add a DNS record')
  .action(async (domain?: string) => {
    const { dnsapiAdd } = await import('./commands/dnsapi');
    await dnsapiAdd(domain);
  });

dnsCmd
  .command('delete [domain]')
  .alias('rm')
  .description('Delete a DNS record')
  .action(async (domain?: string) => {
    const { dnsapiDelete } = await import('./commands/dnsapi');
    await dnsapiDelete(domain);
  });

dnsCmd
  .command('dkim [domain]')
  .description('Show DKIM key for domain')
  .action(async (domain?: string) => {
    const { dnsapiDkim } = await import('./commands/dnsapi');
    await dnsapiDkim(domain);
  });

// ─── Info ────────────────────────────────────────────────
const infoCmd = program.command('info').description('Connection settings, webmail, CalDAV, and service info');

infoCmd
  .command('connections')
  .alias('ports')
  .description('Show IMAP/SMTP/POP3 connection settings')
  .action(async () => {
    const { infoCommand } = await import('./commands/info');
    await infoCommand('connections');
  });

infoCmd
  .command('webmail')
  .description('Show webmail access URLs')
  .action(async () => {
    const { infoCommand } = await import('./commands/info');
    await infoCommand('webmail');
  });

infoCmd
  .command('caldav')
  .alias('dav')
  .description('Show CalDAV/CardDAV settings')
  .action(async () => {
    const { infoCommand } = await import('./commands/info');
    await infoCommand('caldav');
  });

infoCmd
  .command('api')
  .alias('smtp-api')
  .description('Show SMTP API details')
  .action(async () => {
    const { infoCommand } = await import('./commands/info');
    await infoCommand('smtp-api');
  });

infoCmd
  .command('limits')
  .description('Show service limits')
  .action(async () => {
    const { infoCommand } = await import('./commands/info');
    await infoCommand('limits');
  });

infoCmd
  .command('panels')
  .description('Show management panel URLs')
  .action(async () => {
    const { infoCommand } = await import('./commands/info');
    await infoCommand('panels');
  });

infoCmd
  .command('all')
  .description('Show all information')
  .action(async () => {
    const { infoCommand } = await import('./commands/info');
    await infoCommand('all');
  });

infoCmd
  .command('client [name]')
  .description('Email client setup guide (ios, outlook, thunderbird)')
  .action(async (name?: string) => {
    const { clientSetup } = await import('./commands/info');
    await clientSetup(name);
  });

// ─── Auth ────────────────────────────────────────────────
const authCmd = program.command('auth').description('Authenticate with MXroute DirectAdmin API');

authCmd
  .command('login')
  .description('Authenticate with login key (runs config setup)')
  .action(async () => {
    const { configSetup } = await import('./commands/config');
    await configSetup();
  });

authCmd
  .command('status')
  .description('Check authentication status')
  .action(async () => {
    const { authStatus } = await import('./commands/auth');
    await authStatus();
  });

authCmd
  .command('logout')
  .description('Remove stored credentials')
  .action(async () => {
    const { authLogout } = await import('./commands/auth');
    await authLogout();
  });

// ─── Domains ─────────────────────────────────────────────
const domainsCmd = program.command('domains').description('Manage domains');

domainsCmd
  .command('list')
  .alias('ls')
  .description('List all domains')
  .action(async () => {
    const { domainsList } = await import('./commands/domains');
    await domainsList();
  });

domainsCmd
  .command('info [domain]')
  .description('Show domain details')
  .action(async (domain?: string) => {
    const { domainsInfo } = await import('./commands/domains');
    await domainsInfo(domain);
  });

// ─── Accounts ────────────────────────────────────────────
const accountsCmd = program.command('accounts').description('Manage email accounts');

accountsCmd
  .command('list [domain]')
  .alias('ls')
  .option('-a, --all', 'List accounts across all domains')
  .description('List email accounts')
  .action(async (domain?: string, options?: any) => {
    const { accountsList } = await import('./commands/accounts');
    await accountsList(domain, options);
  });

accountsCmd
  .command('create [domain]')
  .alias('add')
  .description('Create a new email account')
  .action(async (domain?: string) => {
    const { accountsCreate } = await import('./commands/accounts');
    await accountsCreate(domain);
  });

accountsCmd
  .command('delete [domain]')
  .alias('rm')
  .description('Delete an email account')
  .action(async (domain?: string) => {
    const { accountsDelete } = await import('./commands/accounts');
    await accountsDelete(domain);
  });

accountsCmd
  .command('passwd [domain]')
  .alias('password')
  .description('Change email account password')
  .action(async (domain?: string) => {
    const { accountsPasswd } = await import('./commands/accounts');
    await accountsPasswd(domain);
  });

// ─── Forwarders ──────────────────────────────────────────
const forwardersCmd = program.command('forwarders').alias('fwd').description('Manage email forwarders');

forwardersCmd
  .command('list [domain]')
  .alias('ls')
  .description('List forwarders')
  .action(async (domain?: string) => {
    const { forwardersList } = await import('./commands/forwarders');
    await forwardersList(domain);
  });

forwardersCmd
  .command('create [domain]')
  .alias('add')
  .description('Create a new forwarder')
  .action(async (domain?: string) => {
    const { forwardersCreate } = await import('./commands/forwarders');
    await forwardersCreate(domain);
  });

forwardersCmd
  .command('delete [domain]')
  .alias('rm')
  .description('Delete a forwarder')
  .action(async (domain?: string) => {
    const { forwardersDelete } = await import('./commands/forwarders');
    await forwardersDelete(domain);
  });

// ─── Autoresponders ──────────────────────────────────────
const autoresponderCmd = program
  .command('autoresponder')
  .alias('vacation')
  .description('Manage autoresponders / vacation messages');

autoresponderCmd
  .command('list [domain]')
  .alias('ls')
  .description('List autoresponders')
  .action(async (domain?: string) => {
    const { autoresponderList } = await import('./commands/autoresponder');
    await autoresponderList(domain);
  });

autoresponderCmd
  .command('create [domain]')
  .alias('add')
  .description('Create an autoresponder')
  .action(async (domain?: string) => {
    const { autoresponderCreate } = await import('./commands/autoresponder');
    await autoresponderCreate(domain);
  });

autoresponderCmd
  .command('edit [domain]')
  .description('Edit an autoresponder')
  .action(async (domain?: string) => {
    const { autoresponderEdit } = await import('./commands/autoresponder');
    await autoresponderEdit(domain);
  });

autoresponderCmd
  .command('delete [domain]')
  .alias('rm')
  .description('Delete an autoresponder')
  .action(async (domain?: string) => {
    const { autoresponderDelete } = await import('./commands/autoresponder');
    await autoresponderDelete(domain);
  });

// ─── Catch-All ───────────────────────────────────────────
const catchallCmd = program.command('catchall').description('Manage catch-all / default address');

catchallCmd
  .command('get [domain]')
  .alias('show')
  .description('Show current catch-all setting')
  .action(async (domain?: string) => {
    const { catchallGet } = await import('./commands/catchall');
    await catchallGet(domain);
  });

catchallCmd
  .command('set [domain]')
  .description('Configure catch-all address')
  .action(async (domain?: string) => {
    const { catchallSet } = await import('./commands/catchall');
    await catchallSet(domain);
  });

// ─── Spam ────────────────────────────────────────────────
const spamCmd = program.command('spam').description('Manage SpamAssassin settings');

spamCmd
  .command('status [domain]')
  .alias('show')
  .description('Show spam filter status')
  .action(async (domain?: string) => {
    const { spamStatus } = await import('./commands/spam');
    await spamStatus(domain);
  });

spamCmd
  .command('enable [domain]')
  .alias('on')
  .description('Enable SpamAssassin')
  .action(async (domain?: string) => {
    const { spamEnable } = await import('./commands/spam');
    await spamEnable(domain);
  });

spamCmd
  .command('disable [domain]')
  .alias('off')
  .description('Disable SpamAssassin')
  .action(async (domain?: string) => {
    const { spamDisable } = await import('./commands/spam');
    await spamDisable(domain);
  });

spamCmd
  .command('config [domain]')
  .description('Configure SpamAssassin settings')
  .action(async (domain?: string) => {
    const { spamConfig } = await import('./commands/spam');
    await spamConfig(domain);
  });

// ─── DNS Records (via API) ──────────────────────────────
const dnsapiCmd = program
  .command('dnsrecords', { hidden: true })
  .alias('dnsapi')
  .description('DNS records (use dns list/add/delete instead)');

dnsapiCmd
  .command('list [domain]')
  .alias('ls')
  .description('List all DNS records')
  .action(async (domain?: string) => {
    const { dnsapiList } = await import('./commands/dnsapi');
    await dnsapiList(domain);
  });

dnsapiCmd
  .command('add [domain]')
  .description('Add a DNS record')
  .action(async (domain?: string) => {
    const { dnsapiAdd } = await import('./commands/dnsapi');
    await dnsapiAdd(domain);
  });

dnsapiCmd
  .command('delete [domain]')
  .alias('rm')
  .description('Delete a DNS record')
  .action(async (domain?: string) => {
    const { dnsapiDelete } = await import('./commands/dnsapi');
    await dnsapiDelete(domain);
  });

dnsapiCmd
  .command('dkim [domain]')
  .description('Show DKIM key for domain')
  .action(async (domain?: string) => {
    const { dnsapiDkim } = await import('./commands/dnsapi');
    await dnsapiDkim(domain);
  });

// ─── Email Filters ───────────────────────────────────────
const filtersCmd = program.command('filters').description('Manage email filters');

filtersCmd
  .command('list [domain]')
  .alias('ls')
  .description('List filters for an account')
  .action(async (domain?: string) => {
    const { filtersList } = await import('./commands/filters');
    await filtersList(domain);
  });

filtersCmd
  .command('create [domain]')
  .alias('add')
  .description('Create an email filter')
  .action(async (domain?: string) => {
    const { filtersCreate } = await import('./commands/filters');
    await filtersCreate(domain);
  });

filtersCmd
  .command('delete [domain]')
  .alias('rm')
  .description('Delete an email filter')
  .action(async (domain?: string) => {
    const { filtersDelete } = await import('./commands/filters');
    await filtersDelete(domain);
  });

// ─── Mailing Lists ──────────────────────────────────────
const listsCmd = program.command('lists').alias('mailinglist').description('Manage mailing lists');

listsCmd
  .command('list [domain]')
  .alias('ls')
  .description('List all mailing lists')
  .action(async (domain?: string) => {
    const { mailingListsList } = await import('./commands/lists');
    await mailingListsList(domain);
  });

listsCmd
  .command('create [domain]')
  .alias('add')
  .description('Create a mailing list')
  .action(async (domain?: string) => {
    const { mailingListsCreate } = await import('./commands/lists');
    await mailingListsCreate(domain);
  });

listsCmd
  .command('delete [domain]')
  .alias('rm')
  .description('Delete a mailing list')
  .action(async (domain?: string) => {
    const { mailingListsDelete } = await import('./commands/lists');
    await mailingListsDelete(domain);
  });

listsCmd
  .command('members [domain]')
  .description('Show mailing list members')
  .action(async (domain?: string) => {
    const { mailingListsMembers } = await import('./commands/lists');
    await mailingListsMembers(domain);
  });

listsCmd
  .command('add-member [domain]')
  .description('Add member to mailing list')
  .action(async (domain?: string) => {
    const { mailingListsAddMember } = await import('./commands/lists');
    await mailingListsAddMember(domain);
  });

listsCmd
  .command('remove-member [domain]')
  .description('Remove member from mailing list')
  .action(async (domain?: string) => {
    const { mailingListsRemoveMember } = await import('./commands/lists');
    await mailingListsRemoveMember(domain);
  });

// ─── Domain Aliases ──────────────────────────────────────
const aliasesCmd = program.command('aliases').description('Manage domain aliases / pointers');

aliasesCmd
  .command('list [domain]')
  .alias('ls')
  .description('List domain aliases')
  .action(async (domain?: string) => {
    const { aliasesList } = await import('./commands/aliases');
    await aliasesList(domain);
  });

aliasesCmd
  .command('add [domain]')
  .description('Add a domain alias')
  .action(async (domain?: string) => {
    const { aliasesAdd } = await import('./commands/aliases');
    await aliasesAdd(domain);
  });

aliasesCmd
  .command('remove [domain]')
  .alias('rm')
  .description('Remove a domain alias')
  .action(async (domain?: string) => {
    const { aliasesRemove } = await import('./commands/aliases');
    await aliasesRemove(domain);
  });

// ─── Quota ───────────────────────────────────────────────
const quotaCmd = program.command('quota').description('Account usage and quotas');

quotaCmd
  .command('show')
  .alias('overview')
  .description('Show account-wide usage stats')
  .action(async () => {
    const { quotaOverview } = await import('./commands/quota');
    await quotaOverview();
  });

quotaCmd
  .command('set [domain]')
  .description('Set email account quota')
  .action(async (domain?: string) => {
    const { quotaSet } = await import('./commands/quota');
    await quotaSet(domain);
  });

// ─── Whoami ──────────────────────────────────────────────
program
  .command('whoami')
  .description('Quick account overview')
  .action(async () => {
    const { whoamiCommand } = await import('./commands/whoami');
    await whoamiCommand();
  });

// ─── Open ────────────────────────────────────────────────
program
  .command('open [target]')
  .description('Open MXroute panels in browser (panel, webmail, management)')
  .action(async (target?: string) => {
    const { openCommand } = await import('./commands/open');
    await openCommand(target);
  });

// ─── Doctor ──────────────────────────────────────────────
program
  .command('doctor')
  .alias('healthcheck')
  .description('Full health check — auth, DNS (all domains), quota, connectivity')
  .action(async () => {
    const { doctorCommand } = await import('./commands/doctor');
    await doctorCommand();
  });

// ─── Export / Import ─────────────────────────────────────
program
  .command('export [domain]')
  .description('Export domain config (accounts, forwarders, autoresponders)')
  .action(async (domain?: string) => {
    const { exportCommand } = await import('./commands/export-import');
    await exportCommand(domain);
  });

program
  .command('import [file]')
  .description('Import domain config from export file')
  .action(async (file?: string) => {
    const { importCommand } = await import('./commands/export-import');
    await importCommand(file);
  });

// ─── Fix ─────────────────────────────────────────────────
program
  .command('fix')
  .description('Auto-fix all issues found by audit (DNS, catch-all, DMARC)')
  .action(async () => {
    const { fixCommand } = await import('./commands/fix');
    await fixCommand();
  });

// ─── Onboard ─────────────────────────────────────────────
program
  .command('onboard [domain]')
  .description('Complete domain onboarding — accounts, DNS, verification')
  .action(async (domain?: string) => {
    const { onboardCommand } = await import('./commands/onboard');
    await onboardCommand(domain);
  });

// ─── Report ──────────────────────────────────────────────
program
  .command('report')
  .description('Generate HTML infrastructure report')
  .action(async () => {
    const { reportCommand } = await import('./commands/report');
    await reportCommand();
  });

// ─── Header Analyze ──────────────────────────────────────
program
  .command('header-analyze')
  .alias('headers')
  .description('Analyze email headers — routing, auth, spam scores')
  .action(async () => {
    const { headerAnalyzeCommand } = await import('./commands/header-analyze');
    await headerAnalyzeCommand();
  });

// ─── Migrate ─────────────────────────────────────────────
program
  .command('migrate')
  .description('Guided email migration wizard (imapsync)')
  .action(async () => {
    const { migrateCommand } = await import('./commands/migrate');
    await migrateCommand();
  });

// ─── Notify ──────────────────────────────────────────────
const notifyCmd = program.command('notify').description('Notification channels (Slack, Discord, Telegram)');

notifyCmd
  .command('setup')
  .description('Configure notification channel')
  .action(async () => {
    const { notifySetup } = await import('./commands/notify');
    await notifySetup();
  });

notifyCmd
  .command('test')
  .description('Send a test notification')
  .action(async () => {
    const { notifyTest } = await import('./commands/notify');
    await notifyTest();
  });

// ─── Audit ───────────────────────────────────────────────
program
  .command('audit')
  .description('Security audit with score — DNS, catch-all, forwarding loops')
  .action(async () => {
    const { auditCommand } = await import('./commands/audit');
    await auditCommand();
  });

// ─── IP Check ────────────────────────────────────────────
program
  .command('ip [server]')
  .alias('blacklist')
  .description('Check server IP against DNS blacklists')
  .action(async (server?: string) => {
    const { ipCheckCommand } = await import('./commands/ip');
    await ipCheckCommand(server);
  });

// ─── Share ───────────────────────────────────────────────
program
  .command('share [email]')
  .description('Generate shareable email setup instructions (HTML/terminal)')
  .action(async (email?: string) => {
    const { shareCommand } = await import('./commands/share');
    await shareCommand(email);
  });

// ─── Monitor ─────────────────────────────────────────────
program
  .command('monitor')
  .description('Health check for IMAP/SMTP ports and DNS (cron-friendly)')
  .option('-q, --quiet', 'Suppress output (exit code only)')
  .option('-a, --alert', 'Send alert email on failure')
  .action(async (options) => {
    const { monitorCommand } = await import('./commands/monitor');
    await monitorCommand(options);
  });

// ─── Webhook ─────────────────────────────────────────────
program
  .command('webhook')
  .description('Start local HTTP server that relays email via MXroute')
  .option('-p, --port <port>', 'Port to listen on', '3025')
  .option('-k, --api-key <key>', 'Require API key for authentication')
  .action(async (options) => {
    const { webhookCommand } = await import('./commands/webhook');
    await webhookCommand(options);
  });

// ─── Completions ─────────────────────────────────────────
program
  .command('completions [shell]')
  .description('Generate shell completions (bash, zsh, fish)')
  .action(async (shell?: string) => {
    const { completionsCommand } = await import('./commands/completions');
    completionsCommand(shell);
  });

// ─── Bulk ────────────────────────────────────────────────
const bulkCmd = program.command('bulk').description('Bulk operations from CSV files');

bulkCmd
  .command('accounts [domain]')
  .description('Bulk create email accounts from CSV')
  .action(async (domain?: string) => {
    const { bulkAccounts } = await import('./commands/bulk');
    await bulkAccounts(domain);
  });

bulkCmd
  .command('forwarders [domain]')
  .description('Bulk create forwarders from CSV')
  .action(async (domain?: string) => {
    const { bulkForwarders } = await import('./commands/bulk');
    await bulkForwarders(domain);
  });

// ─── Diff ────────────────────────────────────────────────
program
  .command('diff <file1> <file2>')
  .description('Compare two export files — show added/removed accounts, forwarders')
  .action(async (file1: string, file2: string) => {
    const { diffCommand } = await import('./commands/diff');
    diffCommand(file1, file2);
  });

// ─── Benchmark ───────────────────────────────────────────
program
  .command('benchmark')
  .alias('bench')
  .description('Test IMAP/SMTP connection speed to your MXroute server')
  .action(async () => {
    const { benchmarkCommand } = await import('./commands/benchmark');
    await benchmarkCommand();
  });

// ─── Cron ────────────────────────────────────────────────
const cronCmd = program.command('cron').description('Manage cron-based monitoring');

cronCmd
  .command('setup')
  .description('Install a cron job for periodic monitoring')
  .action(async () => {
    const { cronSetup } = await import('./commands/cron');
    await cronSetup();
  });

cronCmd
  .command('remove')
  .description('Remove the monitoring cron job')
  .action(async () => {
    const { cronRemove } = await import('./commands/cron');
    await cronRemove();
  });

// ─── Troubleshoot ────────────────────────────────────────
program
  .command('troubleshoot')
  .alias('diagnose')
  .description('Interactive troubleshooting wizard')
  .action(async () => {
    const { troubleshootCommand } = await import('./commands/troubleshoot');
    await troubleshootCommand();
  });

// ─── SSL Check ──────────────────────────────────────────
program
  .command('ssl-check [server]')
  .alias('ssl')
  .description('Check SSL certificate expiry, chain, and protocols')
  .action(async (server?: string) => {
    const { sslCheckCommand } = await import('./commands/ssl-check');
    await sslCheckCommand(server);
  });

// ─── Test Delivery ──────────────────────────────────────
program
  .command('test-delivery')
  .description('Send test email and measure delivery timing')
  .action(async () => {
    const { testDeliveryCommand } = await import('./commands/test-delivery');
    await testDeliveryCommand();
  });

// ─── Rate Limit ─────────────────────────────────────────
program
  .command('rate-limit')
  .alias('rate')
  .description('Show current sending rate vs 400/hr limit')
  .action(async () => {
    const { rateLimitCommand } = await import('./commands/rate-limit');
    await rateLimitCommand();
  });

// ─── Accounts Search ────────────────────────────────────
accountsCmd
  .command('search <query>')
  .alias('find')
  .description('Search accounts across all domains')
  .action(async (query: string) => {
    const { accountsSearch } = await import('./commands/accounts-search');
    await accountsSearch(query);
  });

// ─── Forwarders Validate ────────────────────────────────
forwardersCmd
  .command('validate [domain]')
  .alias('check')
  .description('Check all forwarder destinations are reachable')
  .action(async (domain?: string) => {
    const { forwardersValidate } = await import('./commands/forwarders-validate');
    await forwardersValidate(domain);
  });

// ─── SMTP Debug ─────────────────────────────────────────
program
  .command('smtp-debug')
  .alias('smtp')
  .description('Full SMTP session log showing EHLO/AUTH conversation')
  .action(async () => {
    const { smtpDebugCommand } = await import('./commands/smtp-debug');
    await smtpDebugCommand();
  });

// ─── Backup ─────────────────────────────────────────────
program
  .command('mail-backup [domain]')
  .alias('backup')
  .description('Generate IMAP mailbox backup commands (imapsync)')
  .action(async (domain?: string) => {
    const { backupCommand } = await import('./commands/backup');
    await backupCommand(domain);
  });

// ─── Templates ──────────────────────────────────────────
const templatesCmd = program.command('templates').alias('tpl').description('Email template library');

templatesCmd
  .command('list')
  .alias('ls')
  .description('List saved templates')
  .action(async () => {
    const { templatesList } = await import('./commands/templates');
    await templatesList();
  });

templatesCmd
  .command('save')
  .alias('add')
  .description('Save a new email template')
  .action(async () => {
    const { templatesSave } = await import('./commands/templates');
    await templatesSave();
  });

templatesCmd
  .command('send [name]')
  .description('Send email using a template')
  .action(async (name?: string) => {
    const { templatesSend } = await import('./commands/templates');
    await templatesSend(name);
  });

templatesCmd
  .command('delete [name]')
  .alias('rm')
  .description('Delete a template')
  .action(async (name?: string) => {
    const { templatesDelete } = await import('./commands/templates');
    await templatesDelete(name);
  });

// ─── Cleanup ────────────────────────────────────────────
program
  .command('cleanup')
  .description('Find unused accounts, orphaned forwarders, redundant configs')
  .action(async () => {
    const { cleanupCommand } = await import('./commands/cleanup');
    await cleanupCommand();
  });

// ─── Reputation ─────────────────────────────────────────
program
  .command('reputation [domain]')
  .alias('rep')
  .description('Sender reputation — SPF, DKIM, DMARC, blacklists for one domain')
  .action(async (domain?: string) => {
    const { reputationCommand } = await import('./commands/reputation');
    await reputationCommand(domain);
  });

// ─── Usage History ──────────────────────────────────────
program
  .command('usage-history')
  .alias('usage')
  .description('Track quota usage over time with trends')
  .action(async () => {
    const { usageHistoryCommand } = await import('./commands/usage-history');
    await usageHistoryCommand();
  });

// ─── Schedule ───────────────────────────────────────────
const scheduleCmd = program.command('schedule').description('Schedule autoresponder enable/disable by date');

scheduleCmd
  .command('create [domain]')
  .alias('add')
  .description('Schedule an autoresponder for a date range')
  .action(async (domain?: string) => {
    const { scheduleCreate } = await import('./commands/schedule');
    await scheduleCreate(domain);
  });

scheduleCmd
  .command('list')
  .alias('ls')
  .description('List scheduled autoresponders')
  .action(async () => {
    const { scheduleList } = await import('./commands/schedule');
    await scheduleList();
  });

scheduleCmd
  .command('check')
  .description('Process pending schedule changes')
  .action(async () => {
    const { scheduleCheck } = await import('./commands/schedule');
    await scheduleCheck();
  });

// ─── Password Audit ─────────────────────────────────────
program
  .command('password-audit')
  .alias('passwd-audit')
  .description('Test password strength and bulk-reset weak passwords')
  .action(async () => {
    const { passwordAuditCommand } = await import('./commands/password-audit');
    await passwordAuditCommand();
  });

// ─── Aliases Sync ───────────────────────────────────────
aliasesCmd
  .command('sync')
  .description('Copy domain pointer aliases from one server profile to another')
  .action(async () => {
    const { aliasesSyncCommand } = await import('./commands/aliases-sync');
    await aliasesSyncCommand();
  });

// ─── Mail (Full Client) ─────────────────────────────────
const mailCmd = program
  .command('mail')
  .alias('email')
  .description('Full email client — read, compose, reply, search, manage folders');

mailCmd
  .command('inbox [folder]')
  .alias('ls')
  .description('List recent messages in inbox or folder')
  .action(async (folder?: string) => {
    const { mailInbox } = await import('./commands/mail');
    await mailInbox(folder);
  });

mailCmd
  .command('read <uid>')
  .alias('show')
  .description('Read a specific email by UID')
  .action(async (uid: string) => {
    const { mailRead } = await import('./commands/mail');
    await mailRead(uid);
  });

mailCmd
  .command('compose')
  .alias('new')
  .description('Compose and send email with CC/BCC/attachments')
  .action(async () => {
    const { mailCompose } = await import('./commands/mail');
    await mailCompose();
  });

mailCmd
  .command('reply <uid>')
  .description('Reply to an email')
  .action(async (uid: string) => {
    const { mailReply } = await import('./commands/mail');
    await mailReply(uid);
  });

mailCmd
  .command('forward <uid>')
  .alias('fwd')
  .description('Forward an email')
  .action(async (uid: string) => {
    const { mailForward } = await import('./commands/mail');
    await mailForward(uid);
  });

mailCmd
  .command('delete <uid>')
  .alias('rm')
  .description('Delete an email')
  .action(async (uid: string) => {
    const { mailDelete } = await import('./commands/mail');
    await mailDelete(uid);
  });

mailCmd
  .command('search <query>')
  .alias('find')
  .description('Search emails by subject, sender, or body')
  .action(async (query: string) => {
    const { mailSearch } = await import('./commands/mail');
    await mailSearch(query);
  });

mailCmd
  .command('folders')
  .description('List all mailbox folders')
  .action(async () => {
    const { mailFolders } = await import('./commands/mail');
    await mailFolders();
  });

mailCmd
  .command('folder-create [name]')
  .description('Create a new folder')
  .action(async (name?: string) => {
    const { mailFolderCreate } = await import('./commands/mail');
    await mailFolderCreate(name);
  });

mailCmd
  .command('folder-delete [name]')
  .description('Delete a folder')
  .action(async (name?: string) => {
    const { mailFolderDelete } = await import('./commands/mail');
    await mailFolderDelete(name);
  });

mailCmd
  .command('move <uid> [folder]')
  .description('Move email to a different folder')
  .action(async (uid: string, folder?: string) => {
    const { mailMove } = await import('./commands/mail');
    await mailMove(uid, folder);
  });

mailCmd
  .command('save-attachment <uid>')
  .alias('save')
  .description('Save email attachments to disk')
  .action(async (uid: string) => {
    const { mailSaveAttachment } = await import('./commands/mail');
    await mailSaveAttachment(uid);
  });

mailCmd
  .command('unread')
  .alias('count')
  .description('Show unread message count')
  .action(async () => {
    const { mailUnread } = await import('./commands/mail');
    await mailUnread();
  });

mailCmd
  .command('mark-read <uid>')
  .description('Mark a message as read')
  .action(async (uid: string) => {
    const { mailMarkRead } = await import('./commands/mail');
    await mailMarkRead(uid);
  });

mailCmd
  .command('mark-unread <uid>')
  .description('Mark a message as unread')
  .action(async (uid: string) => {
    const { mailMarkUnread } = await import('./commands/mail');
    await mailMarkUnread(uid);
  });

// ─── Quick Actions ───────────────────────────────────────
program
  .command('test')
  .description('Send a test email to yourself')
  .action(async () => {
    const { getSendingAccount } = await import('./utils/sending-account');
    const { sendEmail } = await import('./utils/api');
    const ora = (await import('ora')).default;
    const chalk = (await import('chalk')).default;

    const account = await getSendingAccount();

    const spinner = ora({ text: 'Sending test email to yourself...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const result = await sendEmail({
        server: account.server,
        username: account.email,
        password: account.password,
        from: account.email,
        to: account.email,
        subject: `MXroute CLI Test — ${new Date().toLocaleString()}`,
        body: `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #6C63FF;">MXroute CLI</h2>
          <p>This test email was sent from the MXroute CLI at <strong>${new Date().toLocaleString()}</strong>.</p>
          <p style="color: #00E676;">✓ Your configuration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Server: ${account.server}</p>
        </div>`,
      });

      if (result.success) {
        spinner.succeed(chalk.green(`Test email sent to ${account.email}`));
      } else {
        spinner.fail(chalk.red(result.message));
      }
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
    console.log('');
  });

// ─── Self-Service Password Change ────────────────────────
program
  .command('password')
  .alias('passwd')
  .description('Change your own email password (self-service, verifies current password first)')
  .action(async () => {
    const { selfServicePasswordChange } = await import('./commands/password');
    await selfServicePasswordChange();
  });

// ─── Provisioning ────────────────────────────────────────
const provisionCmd = program
  .command('provision')
  .description('Business provisioning — create accounts, forwarders, and DNS from a manifest');

provisionCmd
  .command('plan <manifest>')
  .description('Dry-run: show what a manifest would create/skip')
  .action(async (manifest: string) => {
    const { provisionPlan } = await import('./commands/provision');
    await provisionPlan(manifest);
  });

provisionCmd
  .command('apply <manifest>')
  .alias('execute')
  .description('Execute a provisioning manifest — create all resources')
  .action(async (manifest: string) => {
    const { provisionExecute } = await import('./commands/provision');
    await provisionExecute(manifest);
  });

provisionCmd
  .command('generate [domain]')
  .alias('export')
  .description('Generate a manifest from existing domain configuration')
  .action(async (domain?: string) => {
    const { provisionGenerate } = await import('./commands/provision');
    await provisionGenerate(domain);
  });

// ─── Welcome Emails ──────────────────────────────────────
program
  .command('welcome-send [domain]')
  .alias('welcome')
  .description('Send branded welcome emails with setup instructions to accounts')
  .action(async (domain?: string) => {
    const { welcomeSend } = await import('./commands/welcome-send');
    await welcomeSend(domain);
  });

// ─── Credentials Export ──────────────────────────────────
program
  .command('credentials-export [domain]')
  .alias('creds-export')
  .description('Export account credentials as CSV, 1Password-compatible, or JSON')
  .action(async (domain?: string) => {
    const { credentialsExport } = await import('./commands/credentials-export');
    await credentialsExport(domain);
  });

// ─── Deprovision (Employee Offboarding) ──────────────────
program
  .command('deprovision [domain]')
  .alias('offboard')
  .description('Offboard an employee — forward emails, set auto-reply, or delete account')
  .action(async (domain?: string) => {
    const { deprovisionAccount } = await import('./commands/deprovision');
    await deprovisionAccount(domain);
  });

// ─── Quota Policy ────────────────────────────────────────
const quotaPolicyCmd = program
  .command('quota-policy')
  .alias('qp')
  .description('Apply role-based quota policies to accounts');

quotaPolicyCmd
  .command('apply [domain]')
  .description('Apply quota policy from file or uniform value')
  .action(async (domain?: string) => {
    const { quotaPolicyApply } = await import('./commands/quota-policy');
    await quotaPolicyApply(domain);
  });

quotaPolicyCmd
  .command('generate [domain]')
  .description('Generate a sample quota policy file from existing accounts')
  .action(async (domain?: string) => {
    const { quotaPolicyGenerate } = await import('./commands/quota-policy');
    await quotaPolicyGenerate(domain);
  });

// ─── Guide ───────────────────────────────────────────────
program
  .command('guide [topic]')
  .alias('learn')
  .description('Interactive command explorer with examples')
  .action(async (topic?: string) => {
    const { guideCommand } = await import('./commands/guide');
    await guideCommand(topic);
  });

// ─── Suggest ─────────────────────────────────────────────
program
  .command('suggest <prompt>')
  .alias('find-command')
  .description('Find the right command from a description')
  .action(async (prompt: string) => {
    const { suggestCommand } = await import('./commands/suggest');
    suggestCommand(prompt);
  });

// ─── Playbook ────────────────────────────────────────────
const playbookCmd = program.command('playbook').description('Declarative YAML workflow runner');

playbookCmd
  .command('run <file>')
  .description('Execute a playbook')
  .option('--var <key=value...>', 'Set variables', (val: string, prev: string[]) => [...prev, val], [])
  .option('--dry-run', 'Show what would be executed without running')
  .action(async (file: string, options: any) => {
    const { playbookRun } = await import('./commands/playbook');
    await playbookRun(file, options);
  });

playbookCmd
  .command('validate <file>')
  .description('Validate a playbook YAML file')
  .action(async (file: string) => {
    const { playbookValidate } = await import('./commands/playbook');
    playbookValidate(file);
  });

playbookCmd
  .command('list')
  .alias('ls')
  .description('List saved playbooks')
  .action(async () => {
    const { playbookList } = await import('./commands/playbook');
    playbookList();
  });

playbookCmd
  .command('actions')
  .description('List available playbook actions')
  .action(async () => {
    const { playbookActions } = await import('./commands/playbook');
    playbookActions();
  });

// ─── Dashboard ──────────────────────────────────────────
program
  .command('dashboard')
  .alias('dash')
  .description('Live full-screen terminal dashboard')
  .action(async () => {
    const { dashboardCommand } = await import('./commands/dashboard');
    await dashboardCommand();
  });

// ─── Default action (no command) ─────────────────────────
program.action(async () => {
  const { statusCommand } = await import('./commands/status');
  await statusCommand();
});

program.parse();
