#!/usr/bin/env node

process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name !== 'DeprecationWarning') console.warn(w);
});

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { getConfig, getProfiles } from './utils/config';
import { getSendingAccountSync } from './utils/sending-account';
import { sendEmail } from './utils/api';
import { ImapClient } from './utils/imap';
import { parseMessage, htmlToText, formatFileSize } from './utils/mime';
import {
  DACredentials,
  listDomains,
  listEmailAccounts,
  createEmailAccount,
  deleteEmailAccount,
  changeEmailPassword,
  changeEmailQuota,
  listForwarders,
  getForwarderDestination,
  createForwarder,
  deleteForwarder,
  listAutoresponders,
  createAutoresponder,
  deleteAutoresponder,
  getCatchAll,
  setCatchAll,
  getSpamConfig,
  setSpamConfig,
  listDnsRecords,
  getDkimKey,
  listEmailFilters,
  createEmailFilter,
  deleteEmailFilter,
  listMailingLists,
  getMailingListMembers,
  createMailingList,
  deleteMailingList,
  addMailingListMember,
  removeMailingListMember,
  listDomainPointers,
  addDomainPointer,
  deleteDomainPointer,
  getQuotaUsage,
  getUserConfig,
} from './utils/directadmin';
import { runFullDnsCheck, checkSpfRecord, checkDkimRecord, checkDmarcRecord, checkMxRecords } from './utils/dns';
import { testAuth } from './utils/directadmin';
import { routeDnsAdd, routeDnsDelete } from './utils/dns-router';
import { listProviders } from './providers';

function getCreds(): DACredentials {
  const config = getConfig();
  if (!config.daUsername || !config.daLoginKey) {
    throw new Error('Not authenticated. Run "mxroute auth login" first.');
  }
  return { server: config.server, username: config.daUsername, loginKey: config.daLoginKey };
}

const pkg = require('../package.json');

const server = new McpServer({
  name: 'mxroute',
  version: pkg.version,
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Domain Tools ────────────────────────────────────────

server.tool('list_domains', 'List all domains on your MXroute account', {}, async () => {
  const creds = getCreds();
  const domains = await listDomains(creds);
  return { content: [{ type: 'text', text: JSON.stringify({ domains }, null, 2) }] };
});

server.tool(
  'domain_info',
  'Show domain details including aliases',
  {
    domain: z.string().describe('Domain name'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const pointers = await listDomainPointers(creds, domain).catch(() => ({}));
    const aliases = Object.keys(pointers).filter((k) => k !== 'error' && k !== 'text');
    return {
      content: [
        { type: 'text', text: JSON.stringify({ domain, aliases, server: `${creds.server}.mxrouting.net` }, null, 2) },
      ],
    };
  },
);

// ─── Email Account Tools ─────────────────────────────────

server.tool(
  'list_email_accounts',
  'List email accounts for a domain',
  {
    domain: z.string().describe('Domain name'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const accounts = await listEmailAccounts(creds, domain);
    return {
      content: [
        { type: 'text', text: JSON.stringify({ domain, accounts: accounts.map((a) => `${a}@${domain}`) }, null, 2) },
      ],
    };
  },
);

server.tool(
  'create_email_account',
  'Create a new email account',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Username (before the @)'),
    password: z.string().describe('Password (min 8 characters)'),
    quota: z.number().optional().describe('Quota in MB (0 = unlimited, default: 0)'),
  },
  async ({ domain, username, password, quota }) => {
    const creds = getCreds();
    const result = await createEmailAccount(creds, domain, username, password, quota || 0);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success,
              email: `${username}@${domain}`,
              message: success ? 'Account created' : result.text || result.details || 'Failed',
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'delete_email_account',
  'Delete an email account',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Username (before the @)'),
  },
  async ({ domain, username }) => {
    const creds = getCreds();
    const result = await deleteEmailAccount(creds, domain, username);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success, email: `${username}@${domain}`, message: success ? 'Account deleted' : result.text || 'Failed' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'change_email_password',
  'Change password for an email account',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Username (before the @)'),
    password: z.string().describe('New password'),
  },
  async ({ domain, username, password }) => {
    const creds = getCreds();
    const result = await changeEmailPassword(creds, domain, username, password);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success, message: success ? 'Password changed' : result.text || 'Failed' }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'set_email_quota',
  'Set storage quota for an email account',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Username (before the @)'),
    quota: z.number().describe('Quota in MB (0 = unlimited)'),
  },
  async ({ domain, username, quota }) => {
    const creds = getCreds();
    const result = await changeEmailQuota(creds, domain, username, quota);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success,
              message: success ? `Quota set to ${quota === 0 ? 'unlimited' : quota + 'MB'}` : result.text || 'Failed',
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Forwarder Tools ─────────────────────────────────────

server.tool(
  'list_forwarders',
  'List email forwarders for a domain',
  {
    domain: z.string().describe('Domain name'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const forwarders = await listForwarders(creds, domain);
    const details = [];
    for (const fwd of forwarders) {
      let dest = '';
      try {
        dest = await getForwarderDestination(creds, domain, fwd);
      } catch {}
      details.push({ from: `${fwd}@${domain}`, to: dest });
    }
    return { content: [{ type: 'text', text: JSON.stringify({ domain, forwarders: details }, null, 2) }] };
  },
);

server.tool(
  'create_forwarder',
  'Create an email forwarder',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Username to forward from (before the @)'),
    destination: z.string().describe('Destination email address'),
  },
  async ({ domain, username, destination }) => {
    const creds = getCreds();
    const result = await createForwarder(creds, domain, username, destination);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success,
              from: `${username}@${domain}`,
              to: destination,
              message: success ? 'Forwarder created' : result.text || 'Failed',
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'delete_forwarder',
  'Delete an email forwarder',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Forwarder username (before the @)'),
  },
  async ({ domain, username }) => {
    const creds = getCreds();
    const result = await deleteForwarder(creds, domain, username);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success, message: success ? 'Forwarder deleted' : result.text || 'Failed' }, null, 2),
        },
      ],
    };
  },
);

// ─── Autoresponder Tools ─────────────────────────────────

server.tool(
  'list_autoresponders',
  'List autoresponders for a domain',
  {
    domain: z.string().describe('Domain name'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const autoresponders = await listAutoresponders(creds, domain);
    return { content: [{ type: 'text', text: JSON.stringify({ domain, autoresponders }, null, 2) }] };
  },
);

server.tool(
  'create_autoresponder',
  'Create an autoresponder / vacation message',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Email username (before the @)'),
    message: z.string().describe('Autoresponder message text'),
    cc: z.string().optional().describe('CC address (optional)'),
  },
  async ({ domain, username, message, cc }) => {
    const creds = getCreds();
    const result = await createAutoresponder(creds, domain, username, message, cc);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success, message: success ? 'Autoresponder created' : result.text || 'Failed' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'delete_autoresponder',
  'Delete an autoresponder',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Email username (before the @)'),
  },
  async ({ domain, username }) => {
    const creds = getCreds();
    const result = await deleteAutoresponder(creds, domain, username);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success, message: success ? 'Autoresponder deleted' : result.text || 'Failed' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Catch-All Tools ─────────────────────────────────────

server.tool(
  'get_catchall',
  'Get catch-all setting for a domain',
  {
    domain: z.string().describe('Domain name'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const value = await getCatchAll(creds, domain);
    let description = value;
    if (value === ':fail:') description = 'Reject (bounce to sender)';
    else if (value === ':blackhole:') description = 'Disabled (silently discard)';
    else if (value) description = `Forward to ${value}`;
    else description = 'Not configured';
    return { content: [{ type: 'text', text: JSON.stringify({ domain, catchAll: value, description }, null, 2) }] };
  },
);

server.tool(
  'set_catchall',
  'Set catch-all for a domain',
  {
    domain: z.string().describe('Domain name'),
    address: z.string().describe('Destination email, or ":fail:" to reject, or ":blackhole:" to discard'),
  },
  async ({ domain, address }) => {
    const creds = getCreds();
    const result = await setCatchAll(creds, domain, address);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success, message: success ? `Catch-all set to ${address}` : result.text || 'Failed' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Spam Tools ──────────────────────────────────────────

server.tool(
  'get_spam_config',
  'Get SpamAssassin configuration for a domain',
  {
    domain: z.string().describe('Domain name'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const config = await getSpamConfig(creds, domain);
    return { content: [{ type: 'text', text: JSON.stringify({ domain, spamConfig: config }, null, 2) }] };
  },
);

server.tool(
  'set_spam_config',
  'Configure SpamAssassin for a domain',
  {
    domain: z.string().describe('Domain name'),
    enabled: z.boolean().optional().describe('Enable or disable SpamAssassin'),
    required_score: z.string().optional().describe('Score threshold (1-10, lower = more aggressive)'),
    where: z.string().optional().describe('Where to put spam: "userspamfolder", "inbox", or "delete"'),
  },
  async ({ domain, enabled, required_score, where }) => {
    const creds = getCreds();
    const settings: Record<string, string> = {};
    if (enabled !== undefined) settings.action = enabled ? 'enable' : 'disable';
    if (required_score) settings.required_score = required_score;
    if (where) settings.where = where;
    const result = await setSpamConfig(creds, domain, settings);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success, message: success ? 'Spam config updated' : result.text || 'Failed' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── DNS Tools ───────────────────────────────────────────

server.tool(
  'dns_health_check',
  'Run DNS health check for a domain (MX, SPF, DKIM, DMARC)',
  {
    domain: z.string().describe('Domain name'),
  },
  async ({ domain }) => {
    const config = getConfig();
    const server = config.server;
    if (!server) throw new Error('Server not configured. Run "mxroute config setup" first.');
    const results = await runFullDnsCheck(domain, server);
    const summary = {
      domain,
      passed: results.filter((r) => r.status === 'pass').length,
      total: results.length,
      checks: results.map((r) => ({
        type: r.type,
        status: r.status,
        message: r.message,
        expected: r.expected,
        actual: r.actual,
      })),
    };
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  },
);

server.tool(
  'list_dns_records',
  'List DNS records for a domain via DirectAdmin',
  {
    domain: z.string().describe('Domain name'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const records = await listDnsRecords(creds, domain);
    return { content: [{ type: 'text', text: JSON.stringify({ domain, records }, null, 2) }] };
  },
);

server.tool(
  'add_dns_record',
  'Add a DNS record. Automatically routes to the correct DNS provider based on nameservers.',
  {
    domain: z.string().describe('Domain name'),
    type: z.string().describe('Record type (A, AAAA, CNAME, MX, TXT, SRV)'),
    name: z.string().describe('Record name'),
    value: z.string().describe('Record value'),
    priority: z.number().optional().describe('Priority (for MX records)'),
  },
  async ({ domain, type, name, value, priority }) => {
    const result = await routeDnsAdd(domain, { type, name, value, priority });
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'delete_dns_record',
  'Delete a DNS record. Automatically routes to the correct DNS provider based on nameservers.',
  {
    domain: z.string().describe('Domain name'),
    type: z.string().describe('Record type'),
    name: z.string().describe('Record name'),
    value: z.string().describe('Record value'),
  },
  async ({ domain, type, name, value }) => {
    const result = await routeDnsDelete(domain, { type, name, value });
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'get_dkim_key',
  'Retrieve DKIM key for a domain',
  {
    domain: z.string().describe('Domain name'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const key = await getDkimKey(creds, domain);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              domain,
              recordName: `x._domainkey.${domain}`,
              recordType: 'TXT',
              value: key || null,
              found: !!key,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Email Filter Tools ──────────────────────────────────

server.tool(
  'list_email_filters',
  'List email filters for an account',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Email username (before the @)'),
  },
  async ({ domain, username }) => {
    const creds = getCreds();
    const filters = await listEmailFilters(creds, domain, username);
    return {
      content: [{ type: 'text', text: JSON.stringify({ account: `${username}@${domain}`, filters }, null, 2) }],
    };
  },
);

server.tool(
  'create_email_filter',
  'Create an email filter rule',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Email username (before the @)'),
    name: z.string().describe('Filter name'),
    field: z.string().describe('Field to match: from, to, subject, body'),
    match: z.string().describe('Match type: contains, equals, startswith, endswith'),
    value: z.string().describe('Value to match against'),
    action: z.string().describe('Action: discard, forward, move'),
    destination: z.string().optional().describe('Destination (email for forward, folder for move)'),
  },
  async ({ domain, username, name, field, match, value, action, destination }) => {
    const creds = getCreds();
    const result = await createEmailFilter(creds, domain, username, {
      name,
      field,
      match,
      value,
      action,
      destination: destination || '',
    });
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success, message: success ? 'Filter created' : result.text || 'Failed' }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'delete_email_filter',
  'Delete an email filter',
  {
    domain: z.string().describe('Domain name'),
    username: z.string().describe('Email username (before the @)'),
    filterName: z.string().describe('Name of the filter to delete'),
  },
  async ({ domain, username, filterName }) => {
    const creds = getCreds();
    const result = await deleteEmailFilter(creds, domain, username, filterName);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success, message: success ? 'Filter deleted' : result.text || 'Failed' }, null, 2),
        },
      ],
    };
  },
);

// ─── Mailing List Tools ──────────────────────────────────

server.tool(
  'list_mailing_lists',
  'List mailing lists for a domain',
  {
    domain: z.string().describe('Domain name'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const lists = await listMailingLists(creds, domain);
    return { content: [{ type: 'text', text: JSON.stringify({ domain, lists }, null, 2) }] };
  },
);

server.tool(
  'create_mailing_list',
  'Create a mailing list',
  {
    domain: z.string().describe('Domain name'),
    name: z.string().describe('List name'),
  },
  async ({ domain, name }) => {
    const creds = getCreds();
    const result = await createMailingList(creds, domain, name);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success, list: `${name}@${domain}`, message: success ? 'List created' : result.text || 'Failed' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'delete_mailing_list',
  'Delete a mailing list',
  {
    domain: z.string().describe('Domain name'),
    name: z.string().describe('List name'),
  },
  async ({ domain, name }) => {
    const creds = getCreds();
    const result = await deleteMailingList(creds, domain, name);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success, message: success ? 'List deleted' : result.text || 'Failed' }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'list_mailing_list_members',
  'Show members of a mailing list',
  {
    domain: z.string().describe('Domain name'),
    name: z.string().describe('List name'),
  },
  async ({ domain, name }) => {
    const creds = getCreds();
    const members = await getMailingListMembers(creds, domain, name);
    return { content: [{ type: 'text', text: JSON.stringify({ list: `${name}@${domain}`, members }, null, 2) }] };
  },
);

server.tool(
  'add_mailing_list_member',
  'Add member to a mailing list',
  {
    domain: z.string().describe('Domain name'),
    name: z.string().describe('List name'),
    email: z.string().describe('Email address to add'),
  },
  async ({ domain, name, email }) => {
    const creds = getCreds();
    const result = await addMailingListMember(creds, domain, name, email);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success, message: success ? `Added ${email}` : result.text || 'Failed' }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'remove_mailing_list_member',
  'Remove member from a mailing list',
  {
    domain: z.string().describe('Domain name'),
    name: z.string().describe('List name'),
    email: z.string().describe('Email address to remove'),
  },
  async ({ domain, name, email }) => {
    const creds = getCreds();
    const result = await removeMailingListMember(creds, domain, name, email);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success, message: success ? `Removed ${email}` : result.text || 'Failed' }, null, 2),
        },
      ],
    };
  },
);

// ─── Domain Alias Tools ──────────────────────────────────

server.tool(
  'list_domain_aliases',
  'List domain aliases/pointers',
  {
    domain: z.string().describe('Primary domain name'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const pointers = await listDomainPointers(creds, domain);
    const aliases = Object.keys(pointers).filter((k) => k !== 'error' && k !== 'text');
    return { content: [{ type: 'text', text: JSON.stringify({ domain, aliases }, null, 2) }] };
  },
);

server.tool(
  'add_domain_alias',
  'Add a domain alias/pointer',
  {
    domain: z.string().describe('Primary domain name'),
    alias: z.string().describe('Alias domain to add'),
  },
  async ({ domain, alias }) => {
    const creds = getCreds();
    const result = await addDomainPointer(creds, domain, alias);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success, message: success ? `Added alias ${alias} → ${domain}` : result.text || 'Failed' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'remove_domain_alias',
  'Remove a domain alias/pointer',
  {
    domain: z.string().describe('Primary domain name'),
    alias: z.string().describe('Alias domain to remove'),
  },
  async ({ domain, alias }) => {
    const creds = getCreds();
    const result = await deleteDomainPointer(creds, domain, alias);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success, message: success ? `Removed alias ${alias}` : result.text || 'Failed' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Quota Tools ─────────────────────────────────────────

server.tool('get_quota', 'Get account-wide quota and usage information', {}, async () => {
  const creds = getCreds();
  const [usage, config] = await Promise.all([getQuotaUsage(creds), getUserConfig(creds)]);
  return { content: [{ type: 'text', text: JSON.stringify({ usage, limits: config }, null, 2) }] };
});

// ─── Profile Tools ──────────────────────────────────────

server.tool(
  'list_profiles',
  'List all configured mail profiles. Use profile names with other mail tools to operate on different accounts.',
  {},
  async () => {
    const config = getConfig();
    const profiles = getProfiles();
    const profileList = Object.entries(profiles).map(([name, p]) => ({
      name,
      server: p.server,
      username: p.username,
      domain: p.domain,
      isActive: name === config.activeProfile,
    }));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ activeProfile: config.activeProfile, profiles: profileList }, null, 2),
        },
      ],
    };
  },
);

// ─── Send Email Tools ────────────────────────────────────

server.tool(
  'send_email',
  'Send an email via MXroute SMTP. Supports CC, BCC, and plain text or HTML body.',
  {
    to: z.string().describe('Recipient email address (comma-separated for multiple)'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body (HTML supported)'),
    from: z.string().optional().describe('Sender email (defaults to configured username)'),
    cc: z.string().optional().describe('CC recipients (comma-separated)'),
    bcc: z.string().optional().describe('BCC recipients (comma-separated)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ to, subject, body, from, cc, bcc, profile }) => {
    const smtp = resolveSmtpConfig(profile);

    // If CC/BCC provided, use direct SMTP; otherwise use simple API
    if (cc || bcc) {
      const { buildMimeMessage } = await import('./utils/mime');

      const mime = buildMimeMessage({
        from: from || smtp.username,
        to,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        htmlBody: body,
      });

      await smtpSend(smtp, to, cc, bcc, mime);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, to, cc, bcc, message: 'Email sent' }, null, 2),
          },
        ],
      };
    }

    const result = await sendEmail({
      server: `${smtp.server}.mxrouting.net`,
      username: smtp.username,
      password: smtp.password,
      from: from || smtp.username,
      to,
      subject,
      body,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// ─── SMTP Send Helper ───────────────────────────────────

async function smtpSend(
  config: { server: string; username: string; password: string },
  to: string,
  cc: string | undefined,
  bcc: string | undefined,
  mime: string,
): Promise<void> {
  const tls = await import('tls');

  const allRecipients = [
    ...to.split(',').map((e) => e.trim()),
    ...(cc ? cc.split(',').map((e) => e.trim()) : []),
    ...(bcc ? bcc.split(',').map((e) => e.trim()) : []),
  ].filter(Boolean);

  // Reject CRLF in email addresses to prevent SMTP command injection
  for (const addr of allRecipients) {
    if (/[\r\n]/.test(addr)) {
      throw new Error('Invalid email address: contains newline characters');
    }
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: `${config.server}.mxrouting.net`, port: 465, servername: `${config.server}.mxrouting.net` },
      () => {
        let buffer = '';
        let step = 0;
        let rcptIdx = 0;

        socket.setEncoding('utf-8');
        socket.on('data', (data: string) => {
          buffer += data;
          if (!buffer.includes('\r\n')) return;

          const lines = buffer.split('\r\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line) continue;
            const code = parseInt(line.substring(0, 3), 10);

            if (step === 0 && code === 220) {
              socket.write(`EHLO mxroute-cli\r\n`);
              step = 1;
            } else if (step === 1 && code === 250) {
              socket.write(`AUTH LOGIN\r\n`);
              step = 2;
            } else if (step === 2 && code === 334) {
              socket.write(Buffer.from(config.username).toString('base64') + '\r\n');
              step = 3;
            } else if (step === 3 && code === 334) {
              socket.write(Buffer.from(config.password).toString('base64') + '\r\n');
              step = 4;
            } else if (step === 4 && code === 235) {
              socket.write(`MAIL FROM:<${config.username}>\r\n`);
              step = 5;
            } else if (step === 5 && code === 250) {
              socket.write(`RCPT TO:<${allRecipients[rcptIdx]}>\r\n`);
              step = 6;
            } else if (step === 6 && code === 250) {
              rcptIdx++;
              if (rcptIdx < allRecipients.length) {
                socket.write(`RCPT TO:<${allRecipients[rcptIdx]}>\r\n`);
              } else {
                socket.write('DATA\r\n');
                step = 7;
              }
            } else if (step === 7 && code === 354) {
              socket.write(mime + '\r\n.\r\n');
              step = 8;
            } else if (step === 8 && code === 250) {
              socket.write('QUIT\r\n');
              step = 9;
              resolve();
            } else if (code >= 400) {
              socket.destroy();
              reject(new Error(`SMTP error ${code}: ${line}`));
            }
          }
        });

        socket.on('error', reject);
        socket.setTimeout(30000, () => {
          socket.destroy();
          reject(new Error('SMTP connection timed out'));
        });
      },
    );
  });
}

// ─── Mail / IMAP Tools ──────────────────────────────────

function resolveSmtpConfig(profileName?: string) {
  if (profileName) {
    const profiles = getProfiles();
    const profile = profiles[profileName];
    if (!profile) {
      throw new Error(`Profile "${profileName}" not found. Available: ${Object.keys(profiles).join(', ') || 'none'}`);
    }
    if (!profile.server || !profile.username || !profile.password) {
      throw new Error(`Profile "${profileName}" has incomplete sending account credentials.`);
    }
    return { server: profile.server, username: profile.username, password: profile.password };
  }

  const account = getSendingAccountSync();
  if (!account) {
    throw new Error('No sending account configured. Run "mxroute send" to set one up.');
  }
  return { server: account.server.replace('.mxrouting.net', ''), username: account.email, password: account.password };
}

function getImapConfig(profileName?: string) {
  const smtp = resolveSmtpConfig(profileName);
  return {
    host: `${smtp.server}.mxrouting.net`,
    port: 993,
    user: smtp.username,
    password: smtp.password,
  };
}

async function withImap<T>(fn: (client: ImapClient) => Promise<T>, profileName?: string): Promise<T> {
  const imapConfig = getImapConfig(profileName);
  const client = new ImapClient(imapConfig);
  try {
    await client.connect();
    await client.login();
    return await fn(client);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
      throw new Error(
        `IMAP connection failed: unable to reach ${imapConfig.host}:${imapConfig.port}. Check your server settings.`,
      );
    }
    if (
      msg.includes('NO [AUTHENTICATIONFAILED]') ||
      msg.includes('Invalid credentials') ||
      msg.includes('Login failed')
    ) {
      throw new Error(`IMAP authentication failed for ${imapConfig.user}. Check your password or profile settings.`);
    }
    throw err;
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore logout errors */
    }
    client.disconnect();
  }
}

server.tool(
  'list_messages',
  'List recent emails in a mailbox folder. Returns message UIDs, senders, subjects, dates, read status, and sizes. Use UIDs with read_email, reply_email, forward_email, delete_email, and move_email tools.',
  {
    folder: z.string().optional().describe('Folder name (default: INBOX)'),
    count: z.number().optional().describe('Number of messages to fetch (default: 25, max: 100)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ folder, count, profile }) => {
    const targetFolder = folder || 'INBOX';
    const limit = Math.min(count || 25, 100);

    const result = await withImap(async (client) => {
      const info = await client.selectFolder(targetFolder);
      if (info.exists === 0) {
        return { folder: targetFolder, total: 0, unread: 0, messages: [] };
      }

      const fetchCount = Math.min(info.exists, limit);
      const envelopes = await client.fetchEnvelopes(info.exists, fetchCount);
      envelopes.sort((a, b) => b.seq - a.seq);

      return {
        folder: targetFolder,
        total: info.exists,
        recent: info.recent,
        messages: envelopes.map((env) => ({
          uid: env.uid,
          from: env.from,
          to: env.to,
          subject: env.subject,
          date: env.date,
          isRead: env.flags.includes('\\Seen'),
          isFlagged: env.flags.includes('\\Flagged'),
          size: env.size,
          sizeFormatted: formatFileSize(env.size),
        })),
      };
    }, profile);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'read_email',
  'Read the full content of an email by UID. Returns headers, text body, HTML body, and attachment metadata. Automatically marks the message as read.',
  {
    uid: z.number().describe('Message UID (from list_messages)'),
    folder: z.string().optional().describe('Folder name (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ uid, folder, profile }) => {
    const targetFolder = folder || 'INBOX';

    const result = await withImap(async (client) => {
      await client.selectFolder(targetFolder);
      await client.setFlags(uid, '\\Seen');
      const rawBody = await client.fetchBody(uid);
      const msg = parseMessage(rawBody);

      return {
        uid,
        folder: targetFolder,
        from: msg.from,
        to: msg.to,
        cc: msg.cc || undefined,
        subject: msg.subject,
        date: msg.date,
        messageId: msg.messageId,
        inReplyTo: msg.inReplyTo || undefined,
        textBody: msg.textBody || (msg.htmlBody ? htmlToText(msg.htmlBody) : ''),
        htmlBody: msg.htmlBody || undefined,
        attachments: msg.attachments.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
          sizeFormatted: formatFileSize(a.size),
        })),
      };
    }, profile);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'search_emails',
  'Search emails by subject, sender, or body text. Returns matching message UIDs and envelopes. Use UIDs with read_email for full content.',
  {
    query: z.string().describe('Search term (searches subject, from, and body)'),
    folder: z.string().optional().describe('Folder to search (default: INBOX)'),
    limit: z.number().optional().describe('Max results (default: 50)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ query, folder, limit, profile }) => {
    const targetFolder = folder || 'INBOX';
    const maxResults = Math.min(limit || 50, 100);

    const result = await withImap(async (client) => {
      await client.selectFolder(targetFolder);
      const sanitized = query.replace(/[\r\n]/g, '').replace(/"/g, '\\"');
      const criteria = `OR OR SUBJECT "${sanitized}" FROM "${sanitized}" BODY "${sanitized}"`;
      const uids = await client.search(criteria);

      if (uids.length === 0) {
        return { folder: targetFolder, query, totalMatches: 0, messages: [] };
      }

      const limitedUids = uids.slice(-maxResults);
      const envelopes = await client.fetchEnvelopesByUid(limitedUids);
      envelopes.sort((a, b) => b.uid - a.uid);

      return {
        folder: targetFolder,
        query,
        totalMatches: uids.length,
        messages: envelopes.map((env) => ({
          uid: env.uid,
          from: env.from,
          to: env.to,
          subject: env.subject,
          date: env.date,
          isRead: env.flags.includes('\\Seen'),
          size: env.size,
        })),
      };
    }, profile);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'reply_email',
  'Reply to an email. Fetches the original message, composes a reply with proper In-Reply-To headers and quoted text, and sends it.',
  {
    uid: z.number().describe('UID of the message to reply to'),
    body: z.string().describe('Reply body text'),
    folder: z.string().optional().describe('Folder containing the message (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ uid, body, folder, profile }) => {
    const targetFolder = folder || 'INBOX';
    const smtp = resolveSmtpConfig(profile);

    const originalMsg = await withImap(async (client) => {
      await client.selectFolder(targetFolder);
      const rawBody = await client.fetchBody(uid);
      return parseMessage(rawBody);
    }, profile);

    const replyTo = originalMsg.from.match(/<([^>]+)>/)?.[1] || originalMsg.from;
    const replySubject = originalMsg.subject.startsWith('Re:') ? originalMsg.subject : `Re: ${originalMsg.subject}`;

    const originalBody = originalMsg.textBody || htmlToText(originalMsg.htmlBody);
    const quoted = originalBody
      .split('\n')
      .map((l: string) => `> ${l}`)
      .join('\n');
    const fullBody = `${body.trim()}\n\nOn ${originalMsg.date}, ${originalMsg.from} wrote:\n${quoted}`;

    const result = await sendEmail({
      server: `${smtp.server}.mxrouting.net`,
      username: smtp.username,
      password: smtp.password,
      from: smtp.username,
      to: replyTo,
      subject: replySubject,
      body: `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(fullBody)}</pre>`,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: result.success,
              to: replyTo,
              subject: replySubject,
              message: result.success ? 'Reply sent' : result.message,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'forward_email',
  'Forward an email to another recipient. Includes the original message headers and body.',
  {
    uid: z.number().describe('UID of the message to forward'),
    to: z.string().describe('Recipient email address'),
    note: z.string().optional().describe('Optional note to add before the forwarded message'),
    folder: z.string().optional().describe('Folder containing the message (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ uid, to, note, folder, profile }) => {
    const targetFolder = folder || 'INBOX';
    const smtp = resolveSmtpConfig(profile);

    const originalMsg = await withImap(async (client) => {
      await client.selectFolder(targetFolder);
      const rawBody = await client.fetchBody(uid);
      return parseMessage(rawBody);
    }, profile);

    const originalBody = originalMsg.textBody || htmlToText(originalMsg.htmlBody);
    const forwarded = [
      note ? `${note.trim()}\n\n` : '',
      '---------- Forwarded message ----------',
      `From: ${originalMsg.from}`,
      `Date: ${originalMsg.date}`,
      `Subject: ${originalMsg.subject}`,
      `To: ${originalMsg.to}`,
      '',
      originalBody,
    ].join('\n');

    const result = await sendEmail({
      server: `${smtp.server}.mxrouting.net`,
      username: smtp.username,
      password: smtp.password,
      from: smtp.username,
      to,
      subject: `Fwd: ${originalMsg.subject}`,
      body: `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(forwarded)}</pre>`,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: result.success,
              to,
              subject: `Fwd: ${originalMsg.subject}`,
              message: result.success ? 'Email forwarded' : result.message,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'delete_email',
  'Delete an email by UID. Marks it as deleted and expunges.',
  {
    uid: z.number().describe('Message UID to delete'),
    folder: z.string().optional().describe('Folder name (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ uid, folder, profile }) => {
    const targetFolder = folder || 'INBOX';

    await withImap(async (client) => {
      await client.selectFolder(targetFolder);
      await client.deleteMessage(uid);
    }, profile);

    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, uid, message: 'Message deleted' }, null, 2) }],
    };
  },
);

server.tool(
  'move_email',
  'Move an email to a different folder.',
  {
    uid: z.number().describe('Message UID to move'),
    destination: z.string().describe('Destination folder name'),
    folder: z.string().optional().describe('Source folder (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ uid, destination, folder, profile }) => {
    const sourceFolder = folder || 'INBOX';

    await withImap(async (client) => {
      await client.selectFolder(sourceFolder);
      await client.moveMessage(uid, destination);
    }, profile);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success: true, uid, from: sourceFolder, to: destination, message: 'Message moved' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'mark_email',
  'Mark an email as read, unread, flagged (starred), or unflagged. Supports multiple status changes at once.',
  {
    uid: z.number().describe('Message UID'),
    status: z
      .enum(['read', 'unread', 'flagged', 'unflagged'])
      .describe('Mark as "read", "unread", "flagged", or "unflagged"'),
    folder: z.string().optional().describe('Folder name (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ uid, status, folder, profile }) => {
    const targetFolder = folder || 'INBOX';

    await withImap(async (client) => {
      await client.selectFolder(targetFolder);
      switch (status) {
        case 'read':
          await client.setFlags(uid, '\\Seen');
          break;
        case 'unread':
          await client.setFlags(uid, '\\Seen', '-');
          break;
        case 'flagged':
          await client.setFlags(uid, '\\Flagged');
          break;
        case 'unflagged':
          await client.setFlags(uid, '\\Flagged', '-');
          break;
      }
    }, profile);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, uid, status, message: `Marked as ${status}` }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'get_unread_count',
  'Get the number of unread messages in a folder. Quick check without fetching message details.',
  {
    folder: z.string().optional().describe('Folder name (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ folder, profile }) => {
    const targetFolder = folder || 'INBOX';

    const result = await withImap(async (client) => {
      const info = await client.selectFolder(targetFolder);
      const unreadUids = await client.search('UNSEEN');
      return {
        folder: targetFolder,
        total: info.exists,
        unread: unreadUids.length,
        recent: info.recent,
      };
    }, profile);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'list_mail_folders',
  'List all IMAP mailbox folders (Inbox, Sent, Drafts, Trash, custom folders, etc.)',
  {
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ profile }) => {
    const result = await withImap(async (client) => {
      const folders = await client.listFolders();
      return {
        folders: folders.map((f) => ({
          name: f.name,
          delimiter: f.delimiter,
          flags: f.flags,
          selectable: !f.flags.includes('\\Noselect'),
        })),
      };
    }, profile);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'create_mail_folder',
  'Create a new IMAP mailbox folder.',
  {
    name: z.string().describe('Folder name to create'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ name, profile }) => {
    await withImap(async (client) => {
      await client.createFolder(name);
    }, profile);

    return {
      content: [
        { type: 'text', text: JSON.stringify({ success: true, folder: name, message: 'Folder created' }, null, 2) },
      ],
    };
  },
);

server.tool(
  'delete_mail_folder',
  'Delete an IMAP mailbox folder and all its contents.',
  {
    name: z.string().describe('Folder name to delete'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ name, profile }) => {
    await withImap(async (client) => {
      await client.deleteFolder(name);
    }, profile);

    return {
      content: [
        { type: 'text', text: JSON.stringify({ success: true, folder: name, message: 'Folder deleted' }, null, 2) },
      ],
    };
  },
);

// ─── Attachment Tools ────────────────────────────────────

server.tool(
  'download_attachment',
  'Download an attachment from an email by UID and attachment index. Returns the attachment content as base64.',
  {
    uid: z.number().describe('Message UID (from list_messages or read_email)'),
    index: z.number().describe('Attachment index (0-based, from read_email attachments array)'),
    folder: z.string().optional().describe('Folder name (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ uid, index, folder, profile }) => {
    const targetFolder = folder || 'INBOX';

    const result = await withImap(async (client) => {
      await client.selectFolder(targetFolder);
      const rawBody = await client.fetchBody(uid);
      const msg = parseMessage(rawBody);

      if (msg.attachments.length === 0) {
        throw new Error('This email has no attachments.');
      }
      if (index < 0 || index >= msg.attachments.length) {
        throw new Error(
          `Invalid attachment index ${index}. This email has ${msg.attachments.length} attachment(s) (0-${msg.attachments.length - 1}).`,
        );
      }

      const att = msg.attachments[index];
      return {
        uid,
        folder: targetFolder,
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        sizeFormatted: formatFileSize(att.size),
        contentBase64: att.content.toString('base64'),
      };
    }, profile);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// ─── Bulk Operation Tools ────────────────────────────────

server.tool(
  'bulk_mark',
  'Mark multiple emails at once. Efficient batch operation for read/unread/flagged/unflagged.',
  {
    uids: z.array(z.number()).describe('Array of message UIDs to mark'),
    status: z.enum(['read', 'unread', 'flagged', 'unflagged']).describe('Status to apply'),
    folder: z.string().optional().describe('Folder name (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ uids, status, folder, profile }) => {
    const targetFolder = folder || 'INBOX';

    await withImap(async (client) => {
      await client.selectFolder(targetFolder);
      for (const uid of uids) {
        switch (status) {
          case 'read':
            await client.setFlags(uid, '\\Seen');
            break;
          case 'unread':
            await client.setFlags(uid, '\\Seen', '-');
            break;
          case 'flagged':
            await client.setFlags(uid, '\\Flagged');
            break;
          case 'unflagged':
            await client.setFlags(uid, '\\Flagged', '-');
            break;
        }
      }
    }, profile);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success: true, count: uids.length, status, message: `${uids.length} messages marked as ${status}` },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'bulk_delete',
  'Delete multiple emails at once. Messages are permanently removed.',
  {
    uids: z.array(z.number()).describe('Array of message UIDs to delete'),
    folder: z.string().optional().describe('Folder name (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ uids, folder, profile }) => {
    const targetFolder = folder || 'INBOX';

    await withImap(async (client) => {
      await client.selectFolder(targetFolder);
      for (const uid of uids) {
        await client.deleteMessage(uid);
      }
    }, profile);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success: true, count: uids.length, message: `${uids.length} messages deleted` },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'bulk_move',
  'Move multiple emails to another folder at once.',
  {
    uids: z.array(z.number()).describe('Array of message UIDs to move'),
    destination: z.string().describe('Destination folder name'),
    folder: z.string().optional().describe('Source folder name (default: INBOX)'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ uids, destination, folder, profile }) => {
    const sourceFolder = folder || 'INBOX';

    await withImap(async (client) => {
      await client.selectFolder(sourceFolder);
      for (const uid of uids) {
        await client.moveMessage(uid, destination);
      }
    }, profile);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              count: uids.length,
              from: sourceFolder,
              to: destination,
              message: `${uids.length} messages moved`,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Utility / Diagnostics Tools ─────────────────────────

server.tool(
  'security_audit',
  'Run a comprehensive security audit across all domains. Checks MX, SPF, DKIM, DMARC, catch-all, forwarding loops, and account counts. Returns a scored report.',
  {},
  async () => {
    const creds = getCreds();
    const config = getConfig();
    const domains = await listDomains(creds);

    const results: { domain: string; check: string; status: string; message: string }[] = [];
    let score = 100;

    for (const domain of domains) {
      const mx = await checkMxRecords(domain, config.server);
      results.push({ domain, check: 'MX Records', status: mx.status, message: mx.message });
      if (mx.status === 'fail') score -= 15;
      else if (mx.status === 'warn') score -= 5;

      const spf = await checkSpfRecord(domain);
      results.push({ domain, check: 'SPF Record', status: spf.status, message: spf.message });
      if (spf.status === 'fail') score -= 15;
      else if (spf.status === 'warn') score -= 5;

      const dkim = await checkDkimRecord(domain);
      results.push({ domain, check: 'DKIM Record', status: dkim.status, message: dkim.message });
      if (dkim.status === 'fail') score -= 15;

      const dmarc = await checkDmarcRecord(domain);
      results.push({ domain, check: 'DMARC Record', status: dmarc.status, message: dmarc.message });
      if (dmarc.status === 'fail') score -= 10;
      else if (dmarc.status === 'warn') score -= 5;

      try {
        const catchAll = await getCatchAll(creds, domain);
        if (catchAll && catchAll !== ':fail:' && catchAll !== ':blackhole:') {
          results.push({ domain, check: 'Catch-All', status: 'warn', message: `Enabled: ${catchAll} — attracts spam` });
          score -= 5;
        } else {
          results.push({ domain, check: 'Catch-All', status: 'pass', message: 'Disabled' });
        }
      } catch {
        results.push({ domain, check: 'Catch-All', status: 'info', message: 'Could not check' });
      }

      try {
        const forwarders = await listForwarders(creds, domain);
        for (const fwd of forwarders) {
          try {
            const dest = await getForwarderDestination(creds, domain, fwd);
            if (dest.includes(`@${domain}`)) {
              results.push({ domain, check: 'Forwarding Loop', status: 'warn', message: `${fwd}@${domain} → ${dest}` });
              score -= 3;
            }
          } catch {
            /* skip */
          }
        }
      } catch {
        /* skip */
      }

      try {
        const accounts = await listEmailAccounts(creds, domain);
        results.push({ domain, check: 'Account Count', status: 'info', message: `${accounts.length} accounts` });
      } catch {
        /* skip */
      }
    }

    score = Math.max(0, Math.min(100, score));
    const rating = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';

    return {
      content: [{ type: 'text', text: JSON.stringify({ score, rating, domains: domains.length, results }, null, 2) }],
    };
  },
);

server.tool(
  'check_reputation',
  'Analyze sender reputation for a domain by checking SPF, DKIM, DMARC, MX records, and blacklists. Returns a scored assessment.',
  {
    domain: z.string().describe('Domain to check'),
  },
  async ({ domain }) => {
    const config = getConfig();
    const dns = await import('dns');

    const resolveTxt = (d: string): Promise<string[][]> =>
      new Promise((resolve) => dns.resolveTxt(d, (err, records) => resolve(err ? [] : records || [])));
    const resolveA = (d: string): Promise<string[]> =>
      new Promise((resolve) => dns.resolve4(d, (err, addrs) => resolve(err ? [] : addrs || [])));
    const resolveMxRecords = (d: string): Promise<{ priority: number; exchange: string }[]> =>
      new Promise((resolve) => dns.resolveMx(d, (err: any, addrs: any) => resolve(err ? [] : addrs || [])));

    const checks: { name: string; status: string; detail: string; score: number }[] = [];

    // SPF
    const txtRecords = await resolveTxt(domain);
    const spfRecord = txtRecords.flat().find((r) => r.startsWith('v=spf1'));
    if (spfRecord) {
      const hasHardFail = spfRecord.includes('-all');
      checks.push({
        name: 'SPF',
        status: hasHardFail ? 'pass' : 'warn',
        detail: spfRecord,
        score: hasHardFail ? 20 : 10,
      });
    } else {
      checks.push({ name: 'SPF', status: 'fail', detail: 'No SPF record', score: 0 });
    }

    // DKIM
    const dkimSelectors = ['x', 'default', 'google', 'selector1', 'selector2'];
    let dkimFound = false;
    for (const sel of dkimSelectors) {
      const dkimRecs = await resolveTxt(`${sel}._domainkey.${domain}`);
      if (dkimRecs.length > 0 && dkimRecs.flat().some((r) => r.includes('DKIM1'))) {
        checks.push({ name: 'DKIM', status: 'pass', detail: `Found (selector: ${sel})`, score: 20 });
        dkimFound = true;
        break;
      }
    }
    if (!dkimFound) checks.push({ name: 'DKIM', status: 'warn', detail: 'Not found', score: 0 });

    // DMARC
    const dmarcRecs = await resolveTxt(`_dmarc.${domain}`);
    const dmarcRec = dmarcRecs.flat().find((r) => r.startsWith('v=DMARC1'));
    if (dmarcRec) {
      const hasReject = dmarcRec.includes('p=reject');
      const hasQuarantine = dmarcRec.includes('p=quarantine');
      checks.push({
        name: 'DMARC',
        status: hasReject || hasQuarantine ? 'pass' : 'warn',
        detail: dmarcRec,
        score: hasReject ? 20 : hasQuarantine ? 15 : 5,
      });
    } else {
      checks.push({ name: 'DMARC', status: 'fail', detail: 'No DMARC record', score: 0 });
    }

    // MX
    const mxRecs = await resolveMxRecords(domain);
    if (mxRecs.length > 0) {
      checks.push({ name: 'MX', status: 'pass', detail: mxRecs.map((r) => r.exchange).join(', '), score: 15 });
    } else {
      checks.push({ name: 'MX', status: 'fail', detail: 'No MX records', score: 0 });
    }

    // Blacklists
    const serverHost = config.server ? `${config.server}.mxrouting.net` : null;
    if (serverHost) {
      const ips = await resolveA(serverHost);
      if (ips.length > 0) {
        const reversed = ips[0].split('.').reverse().join('.');
        const blacklists = ['zen.spamhaus.org', 'bl.spamcop.net', 'b.barracudacentral.org'];
        let listed = false;
        for (const bl of blacklists) {
          try {
            const res = await resolveA(`${reversed}.${bl}`);
            if (res.length > 0) {
              listed = true;
              checks.push({ name: 'Blacklist', status: 'fail', detail: `Listed on ${bl}`, score: 0 });
            }
          } catch {
            /* not listed */
          }
        }
        if (!listed) checks.push({ name: 'Blacklist', status: 'pass', detail: 'Not listed', score: 15 });
        checks.push({ name: 'Server IP', status: 'pass', detail: `${serverHost} → ${ips[0]}`, score: 10 });
      }
    }

    const totalScore = Math.min(
      checks.reduce((s, c) => s + c.score, 0),
      100,
    );
    const rating = totalScore >= 90 ? 'Excellent' : totalScore >= 70 ? 'Good' : totalScore >= 50 ? 'Fair' : 'Poor';

    return {
      content: [{ type: 'text', text: JSON.stringify({ domain, score: totalScore, rating, checks }, null, 2) }],
    };
  },
);

server.tool(
  'ssl_check',
  'Check SSL/TLS certificates on IMAP (993), SMTP (465), POP3 (995), and DirectAdmin (2222) ports.',
  {
    server: z.string().optional().describe('Server hostname (defaults to configured server)'),
  },
  async ({ server: serverArg }) => {
    const config = getConfig();
    const serverName = serverArg || config.server;
    if (!serverName) throw new Error('No server specified. Run "mxroute config setup" first.');

    const host = serverName.includes('.') ? serverName : `${serverName}.mxrouting.net`;
    const tls = await import('tls');

    const ports = [
      { port: 993, label: 'IMAP' },
      { port: 465, label: 'SMTP' },
      { port: 995, label: 'POP3' },
      { port: 2222, label: 'DirectAdmin' },
    ];

    const results: any[] = [];
    for (const { port, label } of ports) {
      try {
        const info = await new Promise<any>((resolve, reject) => {
          const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
            const cert = socket.getPeerCertificate();
            const protocol = socket.getProtocol() || 'unknown';
            const cipher = socket.getCipher();
            const validTo = new Date(cert.valid_to);
            const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            resolve({
              subject: String(cert.subject?.CN || ''),
              issuer: String(cert.issuer?.O || cert.issuer?.CN || ''),
              validFrom: cert.valid_from,
              validTo: cert.valid_to,
              daysRemaining,
              protocol,
              cipher: cipher ? cipher.name : 'unknown',
            });
            socket.destroy();
          });
          socket.setTimeout(10000);
          socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Timed out'));
          });
          socket.on('error', reject);
        });
        results.push({
          port,
          label,
          status: info.daysRemaining <= 0 ? 'expired' : info.daysRemaining <= 14 ? 'expiring_soon' : 'valid',
          ...info,
        });
      } catch (err: any) {
        results.push({ port, label, status: 'error', error: err.message });
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify({ host, certificates: results }, null, 2) }] };
  },
);

server.tool(
  'test_delivery',
  'Send a test email to yourself and measure delivery time. Validates SMTP connectivity.',
  {
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ profile }) => {
    const smtp = resolveSmtpConfig(profile);
    const testId = Math.random().toString(36).substring(2, 10);
    const subject = `MXroute Delivery Test [${testId}]`;
    const startTime = Date.now();

    const result = await sendEmail({
      server: `${smtp.server}.mxrouting.net`,
      username: smtp.username,
      password: smtp.password,
      from: smtp.username,
      to: smtp.username,
      subject,
      body: `<p>Test ID: ${testId}. Sent: ${new Date().toISOString()}</p>`,
    });

    const duration = Date.now() - startTime;
    const rating = duration > 5000 ? 'Slow' : duration > 2000 ? 'Average' : duration > 1000 ? 'Good' : 'Excellent';

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: result.success,
              testId,
              subject,
              durationMs: duration,
              rating,
              message: result.success ? 'Check inbox for test email' : result.message,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'check_rate_limit',
  'Show current SMTP sending rate usage. Tracks sends via CLI against the 400 emails/hour limit.',
  {},
  async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { getConfigPath } = await import('./utils/config');

    const rateFile = path.join(path.dirname(getConfigPath()), '.mxroute-send-log.json');
    let sends: number[] = [];
    try {
      sends = JSON.parse(fs.readFileSync(rateFile, 'utf-8')).sends || [];
    } catch {
      /* no log */
    }

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    sends = sends.filter((t: number) => t > oneHourAgo);

    const limit = 400;
    const remaining = Math.max(0, limit - sends.length);
    const usagePercent = Math.round((sends.length / limit) * 100);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sentThisHour: sends.length,
              limit,
              remaining,
              usagePercent,
              status: usagePercent >= 90 ? 'critical' : usagePercent >= 70 ? 'warning' : 'healthy',
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'search_accounts',
  'Search for email accounts by name or address across all domains.',
  {
    query: z.string().describe('Search term (matches against username and email address)'),
  },
  async ({ query }) => {
    const creds = getCreds();
    const domains = await listDomains(creds);
    const results: { email: string; domain: string; user: string }[] = [];
    const searchLower = query.toLowerCase();

    for (const domain of domains) {
      try {
        const accounts = await listEmailAccounts(creds, domain);
        for (const user of accounts) {
          const email = `${user}@${domain}`;
          if (email.toLowerCase().includes(searchLower)) {
            results.push({ email, domain, user });
          }
        }
      } catch {
        /* skip */
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ query, domainsSearched: domains.length, matches: results.length, results }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'validate_forwarders',
  'Validate all forwarders for a domain by checking destination MX/A records.',
  {
    domain: z.string().describe('Domain to validate forwarders for'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const dns = await import('dns');
    const resolveMxRecords = (d: string): Promise<{ priority: number; exchange: string }[]> =>
      new Promise((resolve) => dns.resolveMx(d, (err: any, addrs: any) => resolve(err ? [] : addrs || [])));

    const forwarders = await listForwarders(creds, domain);
    const results: { forwarder: string; destination: string; status: string; issue?: string }[] = [];

    for (const fwd of forwarders) {
      try {
        const dest = await getForwarderDestination(creds, domain, fwd);
        const destinations = dest
          .split(',')
          .map((d: string) => d.trim())
          .filter(Boolean);

        for (const destEmail of destinations) {
          const atIdx = destEmail.lastIndexOf('@');
          if (atIdx === -1) continue;
          const destDomain = destEmail.substring(atIdx + 1);

          if (destDomain === domain) {
            results.push({
              forwarder: `${fwd}@${domain}`,
              destination: destEmail,
              status: 'warn',
              issue: 'Forwards to same domain',
            });
          } else {
            const mx = await resolveMxRecords(destDomain);
            if (mx.length === 0) {
              results.push({
                forwarder: `${fwd}@${domain}`,
                destination: destEmail,
                status: 'fail',
                issue: `No MX records for ${destDomain}`,
              });
            } else {
              results.push({ forwarder: `${fwd}@${domain}`, destination: destEmail, status: 'pass' });
            }
          }
        }
      } catch {
        /* skip */
      }
    }

    const valid = results.filter((r) => r.status === 'pass').length;
    const invalid = results.filter((r) => r.status === 'fail').length;

    return {
      content: [
        { type: 'text', text: JSON.stringify({ domain, total: results.length, valid, invalid, results }, null, 2) },
      ],
    };
  },
);

server.tool(
  'cleanup_audit',
  'Scan for orphaned forwarders, unused autoresponders, misconfigured catch-all, and account/forwarder conflicts across all domains.',
  {},
  async () => {
    const creds = getCreds();
    const domains = await listDomains(creds);
    const dns = await import('dns');
    const resolveMxRecords = (d: string): Promise<{ priority: number; exchange: string }[]> =>
      new Promise((resolve) => dns.resolveMx(d, (err: any, addrs: any) => resolve(err ? [] : addrs || [])));

    const issues: { type: string; severity: string; domain: string; resource: string; description: string }[] = [];

    for (const domain of domains) {
      let accounts: string[] = [];
      let forwarders: string[] = [];
      let autoresponders: string[] = [];

      try {
        accounts = await listEmailAccounts(creds, domain);
      } catch {
        /* skip */
      }
      try {
        forwarders = await listForwarders(creds, domain);
      } catch {
        /* skip */
      }
      try {
        autoresponders = await listAutoresponders(creds, domain);
      } catch {
        /* skip */
      }

      for (const fwd of forwarders) {
        try {
          const dest = await getForwarderDestination(creds, domain, fwd);
          for (const destEmail of dest
            .split(',')
            .map((d: string) => d.trim())
            .filter(Boolean)) {
            const atIdx = destEmail.lastIndexOf('@');
            if (atIdx === -1) continue;
            const destDomain = destEmail.substring(atIdx + 1);
            const destUser = destEmail.substring(0, atIdx);
            if (destDomain === domain && !accounts.includes(destUser)) {
              issues.push({
                type: 'orphaned',
                severity: 'medium',
                domain,
                resource: `${fwd}@${domain} → ${destEmail}`,
                description: 'Forwards to non-existent local account',
              });
            } else if (destDomain !== domain) {
              const mx = await resolveMxRecords(destDomain);
              if (mx.length === 0) {
                issues.push({
                  type: 'orphaned',
                  severity: 'high',
                  domain,
                  resource: `${fwd}@${domain} → ${destEmail}`,
                  description: `Destination domain "${destDomain}" has no MX records`,
                });
              }
            }
          }
        } catch {
          /* skip */
        }
      }

      for (const ar of autoresponders) {
        if (!accounts.includes(ar)) {
          issues.push({
            type: 'orphaned',
            severity: 'low',
            domain,
            resource: `autoresponder: ${ar}@${domain}`,
            description: 'Autoresponder for non-existent account',
          });
        }
      }

      for (const fwd of forwarders) {
        if (accounts.includes(fwd)) {
          issues.push({
            type: 'conflict',
            severity: 'low',
            domain,
            resource: `${fwd}@${domain}`,
            description: 'Account and forwarder share same name',
          });
        }
      }

      try {
        const catchAllVal = await getCatchAll(creds, domain);
        if (
          catchAllVal &&
          catchAllVal !== ':fail:' &&
          catchAllVal !== ':blackhole:' &&
          !accounts.includes(catchAllVal)
        ) {
          issues.push({
            type: 'misconfigured',
            severity: 'medium',
            domain,
            resource: `catch-all: ${catchAllVal}`,
            description: 'Catch-all points to non-existent account',
          });
        }
      } catch {
        /* skip */
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              domainsScanned: domains.length,
              totalIssues: issues.length,
              high: issues.filter((i) => i.severity === 'high').length,
              medium: issues.filter((i) => i.severity === 'medium').length,
              low: issues.filter((i) => i.severity === 'low').length,
              issues,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'health_check',
  'Run comprehensive health diagnostics: config validation, API connectivity, DNS checks across all domains, and quota status.',
  {},
  async () => {
    const config = getConfig();
    const checks: { category: string; check: string; status: string; message: string }[] = [];

    // Config
    checks.push({
      category: 'Config',
      check: 'Server',
      status: config.server ? 'pass' : 'fail',
      message: config.server ? `${config.server}.mxrouting.net` : 'Not configured',
    });
    checks.push({
      category: 'Config',
      check: 'SMTP',
      status: config.username ? 'pass' : 'info',
      message: config.username || 'Not configured',
    });

    // DirectAdmin API
    if (config.daUsername && config.daLoginKey) {
      try {
        const result = await testAuth({
          server: config.server,
          username: config.daUsername,
          loginKey: config.daLoginKey,
        });
        checks.push({
          category: 'API',
          check: 'DirectAdmin Auth',
          status: result.success ? 'pass' : 'fail',
          message: result.success ? `Authenticated as ${config.daUsername}` : result.message || 'Auth failed',
        });
      } catch (err: any) {
        checks.push({ category: 'API', check: 'DirectAdmin Auth', status: 'fail', message: err.message });
      }

      // DNS for all domains
      try {
        const creds = getCreds();
        const domains = await listDomains(creds);
        for (const domain of domains) {
          try {
            const results = await runFullDnsCheck(domain, config.server);
            const passed = results.filter((r) => r.status === 'pass').length;
            const failed = results.filter((r) => r.status === 'fail').length;
            checks.push({
              category: 'DNS',
              check: domain,
              status: failed > 0 ? 'fail' : 'pass',
              message: `${passed}/${results.length} passed${failed > 0 ? `, ${failed} failed` : ''}`,
            });
          } catch {
            checks.push({ category: 'DNS', check: domain, status: 'fail', message: 'DNS check failed' });
          }
        }

        // Quota
        try {
          const usage = await getQuotaUsage(creds);
          const diskUsed = Number(usage.quota || usage.disk || 0);
          checks.push({ category: 'Quota', check: 'Disk', status: 'pass', message: `${diskUsed} MB used` });
        } catch {
          checks.push({ category: 'Quota', check: 'Disk', status: 'warn', message: 'Could not fetch' });
        }
      } catch {
        checks.push({ category: 'DNS', check: 'Domains', status: 'fail', message: 'Could not fetch domains' });
      }
    }

    const issues = checks.filter((c) => c.status === 'fail').length;
    return {
      content: [{ type: 'text', text: JSON.stringify({ healthy: issues === 0, issues, checks }, null, 2) }],
    };
  },
);

server.tool(
  'password_audit',
  'Test a password against common weakness patterns and strength criteria. Returns issues and a strength score.',
  {
    password: z.string().describe('Password to test'),
  },
  async ({ password }) => {
    const issues: string[] = [];
    if (password.length < 8) issues.push('Too short (< 8 characters)');
    if (password.length < 12) issues.push('Could be longer (< 12 characters)');
    if (!/[A-Z]/.test(password)) issues.push('No uppercase letters');
    if (!/[a-z]/.test(password)) issues.push('No lowercase letters');
    if (!/[0-9]/.test(password)) issues.push('No numbers');
    if (!/[^A-Za-z0-9]/.test(password)) issues.push('No special characters');

    const common = [
      'password',
      '123456',
      '12345678',
      'qwerty',
      'abc123',
      'admin',
      'letmein',
      'welcome',
      'changeme',
      'test123',
    ];
    if (common.includes(password.toLowerCase())) issues.push('Common/dictionary password');
    if (/^(.)\1+$/.test(password)) issues.push('Repeated character pattern');
    if (/^[a-z]+$/i.test(password) || /^[0-9]+$/.test(password)) issues.push('Single character class');

    const strength = Math.max(0, 100 - issues.length * 15);
    const rating = strength >= 70 ? 'strong' : strength >= 40 ? 'moderate' : 'weak';

    return { content: [{ type: 'text', text: JSON.stringify({ strength, rating, issues }, null, 2) }] };
  },
);

server.tool(
  'analyze_headers',
  'Analyze raw email headers to extract routing hops, authentication results (SPF/DKIM/DMARC), spam scores, and transit time.',
  {
    headers: z.string().describe('Raw email headers text'),
  },
  async ({ headers }) => {
    const lines = headers
      .replace(/\r\n/g, '\n')
      .replace(/\n[ \t]+/g, ' ')
      .split('\n')
      .filter((l) => l.trim());

    // Parse routing hops
    const hops: { from: string; by: string; protocol: string; timestamp: string }[] = [];
    for (const line of lines) {
      if (!line.toLowerCase().startsWith('received:')) continue;
      const content = line.slice('received:'.length).trim();
      const fromMatch = content.match(/from\s+(\S+)/i);
      const byMatch = content.match(/by\s+(\S+)/i);
      const withMatch = content.match(/with\s+(\S+)/i);
      const dateMatch = content.match(/;\s*(.+)$/);
      hops.push({
        from: fromMatch?.[1] || '',
        by: byMatch?.[1] || 'unknown',
        protocol: withMatch?.[1] || '',
        timestamp: dateMatch?.[1]?.trim() || '',
      });
    }
    hops.reverse();

    // Parse auth results
    const authResults: { method: string; result: string; details: string }[] = [];
    for (const line of lines) {
      if (!line.toLowerCase().startsWith('authentication-results:')) continue;
      const parts = line.slice('authentication-results:'.length).trim().split(';').slice(1);
      for (const part of parts) {
        const match = part.trim().match(/^(\w+)=(\w+)\s*(.*)/);
        if (match) authResults.push({ method: match[1], result: match[2], details: match[3] || '' });
      }
    }

    // Key headers
    const findHeader = (name: string) => {
      const prefix = name.toLowerCase() + ':';
      for (const l of lines) {
        if (l.toLowerCase().startsWith(prefix)) return l.slice(prefix.length).trim();
      }
      return null;
    };

    const spamScore = findHeader('x-spam-score') || findHeader('x-spam-status');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              hops: hops.length,
              route: hops,
              authentication: authResults,
              from: findHeader('from'),
              to: findHeader('to'),
              subject: findHeader('subject'),
              date: findHeader('date'),
              messageId: findHeader('message-id'),
              returnPath: findHeader('return-path'),
              spamScore: spamScore || null,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'export_config',
  'Export domain configuration (accounts, forwarders, autoresponders, catch-all) as JSON for backup.',
  {
    domain: z.string().describe('Domain to export'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const data: any = {
      domain,
      exportedAt: new Date().toISOString(),
      accounts: [],
      forwarders: [],
      autoresponders: [],
      catchAll: null,
    };

    try {
      data.accounts = await listEmailAccounts(creds, domain);
    } catch {
      /* skip */
    }
    try {
      const fwds = await listForwarders(creds, domain);
      for (const fwd of fwds) {
        try {
          const dest = await getForwarderDestination(creds, domain, fwd);
          data.forwarders.push({ name: fwd, destination: dest });
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip */
    }
    try {
      data.autoresponders = await listAutoresponders(creds, domain);
    } catch {
      /* skip */
    }
    try {
      data.catchAll = await getCatchAll(creds, domain);
    } catch {
      /* skip */
    }
    try {
      data.spamConfig = await getSpamConfig(creds, domain);
    } catch {
      /* skip */
    }

    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool('list_templates', 'List all saved email templates.', {}, async () => {
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');
  const dir = path.join(os.homedir(), '.config', 'mxroute-cli', 'templates');

  let templates: any[] = [];
  try {
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.json'));
    templates = files
      .map((f: string) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    /* no templates dir */
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            count: templates.length,
            templates: templates.map((t: any) => ({
              name: t.name,
              subject: t.subject,
              isHtml: t.isHtml,
              variables: t.variables,
              createdAt: t.createdAt,
            })),
          },
          null,
          2,
        ),
      },
    ],
  };
});

server.tool(
  'save_template',
  'Save an email template with optional {{variable}} placeholders.',
  {
    name: z.string().describe('Template name (letters, numbers, hyphens, underscores)'),
    subject: z.string().describe('Email subject line (supports {{variable}} syntax)'),
    body: z.string().describe('Email body (supports {{variable}} syntax)'),
    isHtml: z.boolean().optional().describe('Whether the body is HTML (default: false)'),
  },
  async ({ name, subject, body, isHtml }) => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const dir = path.join(os.homedir(), '.config', 'mxroute-cli', 'templates');

    if (!/^[a-zA-Z0-9_-]+$/.test(name))
      throw new Error('Template name must use only letters, numbers, hyphens, underscores');

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

    const variables = [
      ...new Set(
        [...(subject.match(/\{\{(\w+)\}\}/g) || []), ...(body.match(/\{\{(\w+)\}\}/g) || [])].map((m) =>
          m.replace(/\{\{|\}\}/g, ''),
        ),
      ),
    ];

    const template = { name, subject, body, isHtml: isHtml || false, variables, createdAt: new Date().toISOString() };
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(template, null, 2), { mode: 0o600 });

    return {
      content: [
        { type: 'text', text: JSON.stringify({ success: true, name, variables, message: 'Template saved' }, null, 2) },
      ],
    };
  },
);

server.tool(
  'send_template',
  'Send an email using a saved template. Variables are replaced with provided values.',
  {
    template: z.string().describe('Template name'),
    to: z.string().describe('Recipient email'),
    variables: z
      .record(z.string(), z.string())
      .optional()
      .describe('Variable values as key-value pairs, e.g. {"name": "John"}'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ template: templateName, to, variables, profile }) => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const smtp = resolveSmtpConfig(profile);

    const filePath = path.join(os.homedir(), '.config', 'mxroute-cli', 'templates', `${templateName}.json`);
    let tmpl: any;
    try {
      tmpl = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      throw new Error(`Template "${templateName}" not found`);
    }

    let finalSubject = tmpl.subject;
    let finalBody = tmpl.body;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        finalSubject = finalSubject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        finalBody = finalBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }

    const result = await sendEmail({
      server: `${smtp.server}.mxrouting.net`,
      username: smtp.username,
      password: smtp.password,
      from: smtp.username,
      to,
      subject: finalSubject,
      body: tmpl.isHtml ? finalBody : `<pre style="font-family: system-ui, sans-serif;">${finalBody}</pre>`,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: result.success, to, subject: finalSubject, template: templateName }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'delete_template',
  'Delete a saved email template.',
  {
    name: z.string().describe('Template name to delete'),
  },
  async ({ name }) => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const filePath = path.join(os.homedir(), '.config', 'mxroute-cli', 'templates', `${name}.json`);
    try {
      fs.unlinkSync(filePath);
    } catch {
      throw new Error(`Template "${name}" not found`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, name, message: 'Template deleted' }, null, 2) }],
    };
  },
);

server.tool(
  'usage_history',
  'Get current disk, bandwidth, and account usage with historical trend data if available.',
  {},
  async () => {
    const creds = getCreds();
    const fs = await import('fs');
    const path = await import('path');
    const { getConfigPath } = await import('./utils/config');

    const [usage, userCfg] = await Promise.all([getQuotaUsage(creds), getUserConfig(creds)]);

    const snapshot = {
      timestamp: new Date().toISOString(),
      disk: Number(usage.quota || usage.disk || 0),
      diskLimit: Number(userCfg.quota || userCfg.disk || 0),
      bandwidth: Number(usage.bandwidth || 0),
      bandwidthLimit: Number(userCfg.bandwidth || 0),
      emails: Number(usage.nemails || usage.email || 0),
      domains: Number(usage.vdomains || usage.ndomains || usage.domains || 0),
    };

    // Load and update history
    const historyPath = path.join(path.dirname(getConfigPath()), 'usage-history.json');
    let history: any[] = [];
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    } catch {
      /* no history */
    }

    const lastEntry = history[history.length - 1];
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (!lastEntry || new Date(lastEntry.timestamp).getTime() < oneHourAgo) {
      history.push(snapshot);
      history = history.slice(-90);
      try {
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), { mode: 0o600 });
      } catch {
        /* skip */
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { current: snapshot, historyEntries: history.length, history: history.slice(-10) },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Business Provisioning Tools ─────────────────────────

server.tool(
  'self_service_password',
  'Change an email account password. Requires the domain, username, and new password. Uses DirectAdmin API.',
  {
    domain: z.string().describe('Domain (e.g. example.com)'),
    username: z.string().describe('Username part before @'),
    password: z.string().describe('New password (min 8 chars, mix of upper/lower/numbers)'),
  },
  async ({ domain, username, password }) => {
    const creds = getCreds();
    if (password.length < 8) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Password must be at least 8 characters' }) }] };
    }
    const result = await changeEmailPassword(creds, domain, username, password);
    if (result.error && result.error !== '0') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: result.text || result.details || 'Failed to change password' }),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            account: `${username}@${domain}`,
            message: 'Password changed successfully',
          }),
        },
      ],
    };
  },
);

server.tool(
  'provision_plan',
  'Dry-run a provisioning manifest. Shows what accounts and forwarders would be created or skipped. Accepts manifest as JSON object.',
  {
    manifest: z
      .object({
        company: z.string().optional(),
        domains: z.array(
          z.object({
            name: z.string(),
            accounts: z
              .array(
                z.object({
                  user: z.string(),
                  password: z.string().optional(),
                  quota: z.number().optional(),
                }),
              )
              .optional(),
            forwarders: z
              .array(
                z.object({
                  from: z.string(),
                  to: z.string(),
                }),
              )
              .optional(),
          }),
        ),
      })
      .describe('Provisioning manifest'),
  },
  async ({ manifest }) => {
    const creds = getCreds();
    const plan: { action: string; type: string; resource: string; reason?: string }[] = [];

    for (const domain of manifest.domains) {
      const existingAccounts = await listEmailAccounts(creds, domain.name).catch(() => [] as string[]);
      const existingForwarders = await listForwarders(creds, domain.name).catch(() => [] as string[]);

      for (const acct of domain.accounts || []) {
        if (existingAccounts.includes(acct.user)) {
          plan.push({
            action: 'SKIP',
            type: 'account',
            resource: `${acct.user}@${domain.name}`,
            reason: 'already exists',
          });
        } else {
          plan.push({ action: 'CREATE', type: 'account', resource: `${acct.user}@${domain.name}` });
        }
      }
      for (const fwd of domain.forwarders || []) {
        if (existingForwarders.includes(fwd.from)) {
          plan.push({
            action: 'SKIP',
            type: 'forwarder',
            resource: `${fwd.from}@${domain.name}`,
            reason: 'already exists',
          });
        } else {
          plan.push({ action: 'CREATE', type: 'forwarder', resource: `${fwd.from}@${domain.name} → ${fwd.to}` });
        }
      }
    }

    const creates = plan.filter((p) => p.action === 'CREATE').length;
    const skips = plan.filter((p) => p.action === 'SKIP').length;
    return {
      content: [{ type: 'text', text: JSON.stringify({ plan, summary: { create: creates, skip: skips } }, null, 2) }],
    };
  },
);

server.tool(
  'provision_execute',
  'Execute a provisioning manifest. Creates accounts and forwarders. Generates random passwords for accounts without one. Returns created resources with credentials.',
  {
    manifest: z
      .object({
        company: z.string().optional(),
        domains: z.array(
          z.object({
            name: z.string(),
            accounts: z
              .array(
                z.object({
                  user: z.string(),
                  password: z.string().optional(),
                  quota: z.number().optional(),
                }),
              )
              .optional(),
            forwarders: z
              .array(
                z.object({
                  from: z.string(),
                  to: z.string(),
                }),
              )
              .optional(),
          }),
        ),
      })
      .describe('Provisioning manifest'),
  },
  async ({ manifest }) => {
    const creds = getCreds();
    const crypto = await import('crypto');
    const generatePassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
      let pw = '';
      const bytes = crypto.randomBytes(16);
      for (let i = 0; i < 16; i++) pw += chars[bytes[i] % chars.length];
      return pw;
    };

    const results: { type: string; resource: string; status: string; password?: string; error?: string }[] = [];

    for (const domain of manifest.domains) {
      const existingAccounts = await listEmailAccounts(creds, domain.name).catch(() => [] as string[]);
      const existingForwarders = await listForwarders(creds, domain.name).catch(() => [] as string[]);

      for (const acct of domain.accounts || []) {
        if (existingAccounts.includes(acct.user)) {
          results.push({ type: 'account', resource: `${acct.user}@${domain.name}`, status: 'skipped' });
          continue;
        }
        const pw = acct.password || generatePassword();
        try {
          await createEmailAccount(creds, domain.name, acct.user, pw, acct.quota || 0);
          results.push({ type: 'account', resource: `${acct.user}@${domain.name}`, status: 'created', password: pw });
        } catch (err: any) {
          results.push({
            type: 'account',
            resource: `${acct.user}@${domain.name}`,
            status: 'failed',
            error: err.message,
          });
        }
      }

      for (const fwd of domain.forwarders || []) {
        if (existingForwarders.includes(fwd.from)) {
          results.push({ type: 'forwarder', resource: `${fwd.from}@${domain.name}`, status: 'skipped' });
          continue;
        }
        try {
          await createForwarder(creds, domain.name, fwd.from, fwd.to);
          results.push({ type: 'forwarder', resource: `${fwd.from}@${domain.name} → ${fwd.to}`, status: 'created' });
        } catch (err: any) {
          results.push({
            type: 'forwarder',
            resource: `${fwd.from}@${domain.name}`,
            status: 'failed',
            error: err.message,
          });
        }
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    return {
      content: [{ type: 'text', text: JSON.stringify({ results, summary: { created, skipped, failed } }, null, 2) }],
    };
  },
);

server.tool(
  'provision_generate',
  'Generate a provisioning manifest from an existing domain configuration. Returns JSON manifest with current accounts and forwarders.',
  {
    domain: z.string().describe('Domain to generate manifest from'),
  },
  async ({ domain }) => {
    const creds = getCreds();
    const accounts = await listEmailAccounts(creds, domain).catch(() => [] as string[]);
    const fwdNames = await listForwarders(creds, domain).catch(() => [] as string[]);
    const forwarders: { from: string; to: string }[] = [];
    for (const fwd of fwdNames) {
      try {
        const dest = await getForwarderDestination(creds, domain, fwd);
        forwarders.push({ from: fwd, to: dest });
      } catch {
        /* skip */
      }
    }

    const manifest = {
      company: '',
      domains: [
        {
          name: domain,
          accounts: accounts.map((a) => ({ user: a, quota: 0 })),
          forwarders,
        },
      ],
    };
    return { content: [{ type: 'text', text: JSON.stringify(manifest, null, 2) }] };
  },
);

server.tool(
  'welcome_send',
  'Send a welcome email with setup instructions to an email account. Includes IMAP/SMTP settings and webmail links.',
  {
    to: z.string().describe('Recipient email address'),
    company_name: z.string().optional().describe('Company name for branding'),
    include_password: z.string().optional().describe('Password to include in welcome email'),
    profile: z.string().optional().describe('Named profile to use (default: active profile)'),
  },
  async ({ to, company_name, include_password, profile }) => {
    const smtp = resolveSmtpConfig(profile);
    const heading = company_name || 'Your Email Account';
    const domain = to.split('@')[1] || '';
    const passwordSection = include_password
      ? `<p><strong>Temporary Password:</strong> <code>${include_password}</code><br><em>Please change this immediately after first login.</em></p>`
      : '';

    const html = `<div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #6C63FF;">${heading}</h2>
      <p>Your email account <strong>${to}</strong> is ready!</p>
      ${passwordSection}
      <h3>Server Settings</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>IMAP Server</strong></td><td style="padding: 6px; border: 1px solid #ddd;">${smtp.server}.mxrouting.net</td></tr>
        <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>IMAP Port</strong></td><td style="padding: 6px; border: 1px solid #ddd;">993 (SSL/TLS)</td></tr>
        <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>SMTP Server</strong></td><td style="padding: 6px; border: 1px solid #ddd;">${smtp.server}.mxrouting.net</td></tr>
        <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>SMTP Port</strong></td><td style="padding: 6px; border: 1px solid #ddd;">465 (SSL/TLS)</td></tr>
        <tr><td style="padding: 6px; border: 1px solid #ddd;"><strong>Username</strong></td><td style="padding: 6px; border: 1px solid #ddd;">${to}</td></tr>
      </table>
      <h3>Webmail Access</h3>
      <p>Access your email in a browser: <a href="https://mail.${domain}">https://mail.${domain}</a></p>
      <h3>Email Client Setup</h3>
      <ul>
        <li><strong>Outlook:</strong> Add Account → IMAP → use settings above</li>
        <li><strong>Apple Mail:</strong> Preferences → Accounts → Add → Other Mail</li>
        <li><strong>Thunderbird:</strong> Account Settings → Add Mail Account</li>
        <li><strong>Mobile:</strong> Settings → Mail → Add Account → Other</li>
      </ul>
    </div>`;

    const { buildMimeMessage } = await import('./utils/mime');
    const mime = buildMimeMessage({
      from: smtp.username,
      to,
      subject: `Welcome to ${heading} — Your Email Setup Instructions`,
      textBody: `Your email account ${to} is ready. IMAP: ${smtp.server}.mxrouting.net:993 (SSL). SMTP: ${smtp.server}.mxrouting.net:465 (SSL). Webmail: https://mail.${domain}`,
      htmlBody: html,
    });
    await smtpSend(smtp, to, undefined, undefined, mime);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, to, message: 'Welcome email sent' }) }] };
  },
);

server.tool(
  'credentials_export',
  'Export account credentials for a domain. Returns structured data with email addresses, server settings, and connection details.',
  {
    domain: z.string().describe('Domain to export credentials for'),
    format: z.enum(['json', 'csv', '1password']).optional().describe('Export format (default: json)'),
  },
  async ({ domain, format }) => {
    const creds = getCreds();
    const config = getConfig();
    const accounts = await listEmailAccounts(creds, domain);
    const server = config.server || '';

    const data = accounts.map((user) => ({
      email: `${user}@${domain}`,
      server: `${server}.mxrouting.net`,
      imapPort: 993,
      smtpPort: 465,
      webmail: `https://mail.${domain}`,
    }));

    if (format === 'csv') {
      const csv =
        'email,server,imap_port,smtp_port,webmail\n' +
        data.map((d) => `${d.email},${d.server},${d.imapPort},${d.smtpPort},${d.webmail}`).join('\n');
      return { content: [{ type: 'text', text: csv }] };
    }
    if (format === '1password') {
      const csv =
        'Title,Website,Username,Password,Notes\n' +
        data
          .map((d) => `${d.email},${d.webmail},${d.email},SET_BY_ADMIN,"IMAP: ${d.server}:993 SMTP: ${d.server}:465"`)
          .join('\n');
      return { content: [{ type: 'text', text: csv }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'deprovision_account',
  'Offboard an employee email account. Can forward their email to another account, or delete the account entirely.',
  {
    domain: z.string().describe('Domain'),
    username: z.string().describe('Username to offboard (part before @)'),
    action: z.enum(['forward', 'delete']).describe('What to do: forward emails to someone else, or delete account'),
    forward_to: z.string().optional().describe('Email to forward to (required if action is "forward")'),
  },
  async ({ domain, username, action, forward_to }) => {
    const creds = getCreds();
    const results: string[] = [];

    if (action === 'forward') {
      if (!forward_to) {
        return {
          content: [
            { type: 'text', text: JSON.stringify({ error: 'forward_to is required when action is "forward"' }) },
          ],
        };
      }
      try {
        await createForwarder(creds, domain, username, forward_to);
        results.push(`Created forwarder: ${username}@${domain} → ${forward_to}`);
      } catch (err: any) {
        results.push(`Failed to create forwarder: ${err.message}`);
      }
      try {
        await deleteEmailAccount(creds, domain, username);
        results.push(`Deleted account: ${username}@${domain}`);
      } catch (err: any) {
        results.push(`Failed to delete account: ${err.message}`);
      }
    } else {
      try {
        await deleteEmailAccount(creds, domain, username);
        results.push(`Deleted account: ${username}@${domain}`);
      } catch (err: any) {
        results.push(`Failed to delete account: ${err.message}`);
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify({ account: `${username}@${domain}`, action, results }) }] };
  },
);

server.tool(
  'quota_policy_apply',
  'Apply a quota policy to accounts on a domain. Set uniform quota or per-account quotas.',
  {
    domain: z.string().describe('Domain'),
    quota_mb: z.number().optional().describe('Uniform quota in MB to apply to all accounts'),
    rules: z
      .array(
        z.object({
          pattern: z.string().describe('Account pattern (* for wildcard, e.g. "admin*" or "*")'),
          quota: z.number().describe('Quota in MB'),
        }),
      )
      .optional()
      .describe('Quota rules applied in order, first match wins'),
  },
  async ({ domain, quota_mb, rules }) => {
    const creds = getCreds();
    const accounts = await listEmailAccounts(creds, domain);
    const results: { account: string; quota: number; status: string }[] = [];

    const matchPattern = (name: string, pattern: string): boolean => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(name);
    };

    for (const user of accounts) {
      let targetQuota = quota_mb;
      if (!targetQuota && rules) {
        for (const rule of rules) {
          if (matchPattern(user, rule.pattern)) {
            targetQuota = rule.quota;
            break;
          }
        }
      }
      if (targetQuota === undefined) continue;
      try {
        await changeEmailQuota(creds, domain, user, targetQuota);
        results.push({ account: `${user}@${domain}`, quota: targetQuota, status: 'applied' });
      } catch (err: any) {
        results.push({ account: `${user}@${domain}`, quota: targetQuota, status: `failed: ${err.message}` });
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify({ domain, results, total: results.length }, null, 2) }] };
  },
);

// ─── DNS Provider Tools ──────────────────────────────────

server.tool('list_dns_providers', 'List supported DNS providers with credential status', {}, async () => {
  const config = getConfig() as any;
  const providers = listProviders();
  const providerCreds = config.providers || {};
  const result = providers.map((p) => ({
    id: p.id,
    name: p.name,
    configured: !!providerCreds[p.id],
    credentialFields: p.credentialFields.map((f) => f.label),
    nsPatterns: p.nsPatterns,
  }));
  return { content: [{ type: 'text' as const, text: JSON.stringify({ providers: result }, null, 2) }] };
});

// ─── Start server ────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
