#!/usr/bin/env node

process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name !== 'DeprecationWarning') console.warn(w);
});

import { Command } from 'commander';
import { theme } from './utils/theme';

const pkg = require('../package.json');

const program = new Command();

program
  .name('mxroute')
  .description('A powerful CLI for managing MXroute email hosting')
  .version(pkg.version, '-v, --version')
  .addHelpText('beforeAll', theme.banner());

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
  .command('smtp')
  .description('Configure SMTP credentials for sending email')
  .action(async () => {
    const { configSmtp } = await import('./commands/config');
    await configSmtp();
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
  .description('Send an email via MXroute SMTP API')
  .option('-t, --to <email>', 'Recipient email address')
  .option('-s, --subject <subject>', 'Email subject')
  .option('-b, --body <body>', 'Email body')
  .option('-f, --from <email>', 'Sender email (defaults to configured username)')
  .option('--html', 'Treat body as raw HTML')
  .action(async (options) => {
    const { sendCommand } = await import('./commands/send');
    await sendCommand(options);
  });

// ─── DNS ─────────────────────────────────────────────────
const dnsCmd = program.command('dns').description('DNS record management and verification');

dnsCmd
  .command('check [domain]')
  .description('Run full DNS health check')
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
  .description('List email accounts')
  .action(async (domain?: string) => {
    const { accountsList } = await import('./commands/accounts');
    await accountsList(domain);
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
const dnsapiCmd = program.command('dnsrecords').alias('dnsapi').description('Manage DNS records via DirectAdmin API');

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
program
  .command('quota')
  .description('Show account usage and quotas')
  .action(async () => {
    const { quotaOverview } = await import('./commands/quota');
    await quotaOverview();
  });

program
  .command('quota-set [domain]')
  .description('Set email account quota')
  .action(async (domain?: string) => {
    const { quotaSet } = await import('./commands/quota');
    await quotaSet(domain);
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

// ─── Quick Actions ───────────────────────────────────────
program
  .command('test')
  .description('Send a test email to yourself')
  .action(async () => {
    const { getConfig } = await import('./utils/config');
    const { sendEmail } = await import('./utils/api');
    const ora = (await import('ora')).default;
    const chalk = (await import('chalk')).default;

    const config = getConfig();
    if (!config.server || !config.username || !config.password) {
      console.log(theme.error(`\n  Run ${theme.bold('mxroute config setup')} first.\n`));
      process.exit(1);
    }

    const spinner = ora({ text: 'Sending test email to yourself...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const result = await sendEmail({
        server: `${config.server}.mxrouting.net`,
        username: config.username,
        password: config.password,
        from: config.username,
        to: config.username,
        subject: `MXroute CLI Test — ${new Date().toLocaleString()}`,
        body: `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #6C63FF;">MXroute CLI</h2>
          <p>This test email was sent from the MXroute CLI at <strong>${new Date().toLocaleString()}</strong>.</p>
          <p style="color: #00E676;">✓ Your configuration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Server: ${config.server}.mxrouting.net</p>
        </div>`,
      });

      if (result.success) {
        spinner.succeed(chalk.green(`Test email sent to ${config.username}`));
      } else {
        spinner.fail(chalk.red(result.message));
      }
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
    console.log('');
  });

// ─── Default action (no command) ─────────────────────────
program.action(async () => {
  const { statusCommand } = await import('./commands/status');
  await statusCommand();
});

program.parse();
