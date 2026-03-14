#!/usr/bin/env node

process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name !== 'DeprecationWarning') console.warn(w);
});

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { getConfig } from './utils/config';
import { sendEmail } from './utils/api';
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
  addDnsRecord,
  deleteDnsRecord,
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
import { runFullDnsCheck } from './utils/dns';

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
  'Add a DNS record',
  {
    domain: z.string().describe('Domain name'),
    type: z.string().describe('Record type (A, AAAA, CNAME, MX, TXT, SRV)'),
    name: z.string().describe('Record name'),
    value: z.string().describe('Record value'),
    priority: z.number().optional().describe('Priority (for MX records)'),
  },
  async ({ domain, type, name, value, priority }) => {
    const creds = getCreds();
    const result = await addDnsRecord(creds, domain, type, name, value, priority);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success, message: success ? `Added ${type} record` : result.text || 'Failed' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  'delete_dns_record',
  'Delete a DNS record',
  {
    domain: z.string().describe('Domain name'),
    type: z.string().describe('Record type'),
    name: z.string().describe('Record name'),
    value: z.string().describe('Record value'),
  },
  async ({ domain, type, name, value }) => {
    const creds = getCreds();
    const result = await deleteDnsRecord(creds, domain, type, name, value);
    const success = !result.error || result.error === '0';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success, message: success ? 'Record deleted' : result.text || 'Failed' }, null, 2),
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

// ─── Send Email Tools ────────────────────────────────────

server.tool(
  'send_email',
  'Send an email via MXroute SMTP API',
  {
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body (HTML supported)'),
    from: z.string().optional().describe('Sender email (defaults to configured username)'),
  },
  async ({ to, subject, body, from }) => {
    const config = getConfig();
    if (!config.server || !config.username || !config.password) {
      throw new Error('SMTP not configured. Run "mxroute config setup" first.');
    }
    const result = await sendEmail({
      server: `${config.server}.mxrouting.net`,
      username: config.username,
      password: config.password,
      from: from || config.username,
      to,
      subject,
      body,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// ─── Start server ────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
