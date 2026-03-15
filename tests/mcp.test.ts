import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';

const MCP = path.join(__dirname, '..', 'dist', 'mcp.js');

function mcpRequest(method: string, params: any = {}): any {
  const init = JSON.stringify({
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
  });
  const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const input = `${init}\n${req}`;

  try {
    const output = execSync(`echo '${input}' | node ${MCP}`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const lines = output
      .trim()
      .split('\n')
      .filter((l) => l.trim());
    return JSON.parse(lines[lines.length - 1]);
  } catch (err: any) {
    const output = (err.stdout || '').trim();
    const lines = output.split('\n').filter((l: string) => l.trim());
    if (lines.length > 0) {
      try {
        return JSON.parse(lines[lines.length - 1]);
      } catch {}
    }
    return null;
  }
}

let toolsCache: any[] | null = null;

function getTools(): any[] {
  if (toolsCache) return toolsCache;
  const response = mcpRequest('tools/list');
  toolsCache = response?.result?.tools || [];
  return toolsCache;
}

describe('MCP Server', () => {
  it('should list tools', () => {
    const response = mcpRequest('tools/list');
    expect(response).toBeDefined();
    expect(response.result).toBeDefined();
    expect(response.result.tools).toBeDefined();
    expect(response.result.tools.length).toBeGreaterThan(30);
  });

  it('should have all original management tools', () => {
    const toolNames = getTools().map((t: any) => t.name);
    const expected = [
      'list_domains',
      'list_email_accounts',
      'create_email_account',
      'list_forwarders',
      'create_forwarder',
      'get_catchall',
      'set_catchall',
      'get_spam_config',
      'set_spam_config',
      'dns_health_check',
      'list_dns_records',
      'get_dkim_key',
      'list_mailing_lists',
      'list_domain_aliases',
      'get_quota',
      'send_email',
    ];
    for (const tool of expected) {
      expect(toolNames).toContain(tool);
    }
  });

  it('should have all mail/IMAP tools', () => {
    const toolNames = getTools().map((t: any) => t.name);
    const expected = [
      'list_messages',
      'read_email',
      'search_emails',
      'reply_email',
      'forward_email',
      'delete_email',
      'move_email',
      'mark_email',
      'get_unread_count',
      'list_mail_folders',
      'create_mail_folder',
      'delete_mail_folder',
      'download_attachment',
    ];
    for (const tool of expected) {
      expect(toolNames).toContain(tool);
    }
  });

  it('should have bulk operation tools', () => {
    const toolNames = getTools().map((t: any) => t.name);
    expect(toolNames).toContain('bulk_mark');
    expect(toolNames).toContain('bulk_delete');
    expect(toolNames).toContain('bulk_move');
  });

  it('should have list_profiles tool', () => {
    const toolNames = getTools().map((t: any) => t.name);
    expect(toolNames).toContain('list_profiles');
  });

  it('each tool should have description and schema', () => {
    for (const tool of getTools()) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(5);
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('mail tools should accept profile parameter', () => {
    const mailTools = [
      'list_messages',
      'read_email',
      'search_emails',
      'reply_email',
      'forward_email',
      'delete_email',
      'move_email',
      'mark_email',
      'get_unread_count',
      'list_mail_folders',
      'create_mail_folder',
      'delete_mail_folder',
      'download_attachment',
      'send_email',
      'bulk_mark',
      'bulk_delete',
      'bulk_move',
    ];

    for (const toolName of mailTools) {
      const tool = getTools().find((t: any) => t.name === toolName);
      expect(tool, `Tool ${toolName} not found`).toBeDefined();
      const props = tool.inputSchema?.properties || {};
      expect(props.profile, `Tool ${toolName} missing profile parameter`).toBeDefined();
      expect(props.profile.type).toBe('string');
    }
  });

  it('send_email should accept cc and bcc parameters', () => {
    const tool = getTools().find((t: any) => t.name === 'send_email');
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties;
    expect(props.cc).toBeDefined();
    expect(props.bcc).toBeDefined();
  });

  it('mark_email should support flagged/unflagged status', () => {
    const tool = getTools().find((t: any) => t.name === 'mark_email');
    expect(tool).toBeDefined();
    const statusProp = tool.inputSchema.properties.status;
    expect(statusProp.enum).toContain('read');
    expect(statusProp.enum).toContain('unread');
    expect(statusProp.enum).toContain('flagged');
    expect(statusProp.enum).toContain('unflagged');
  });

  it('bulk_mark should accept uids array and status', () => {
    const tool = getTools().find((t: any) => t.name === 'bulk_mark');
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties;
    expect(props.uids).toBeDefined();
    expect(props.uids.type).toBe('array');
    expect(props.status).toBeDefined();
    expect(props.status.enum).toContain('flagged');
  });

  it('download_attachment should accept uid and index', () => {
    const tool = getTools().find((t: any) => t.name === 'download_attachment');
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties;
    expect(props.uid).toBeDefined();
    expect(props.index).toBeDefined();
    expect(props.folder).toBeDefined();
  });

  it('should have all utility/diagnostic MCP tools', () => {
    const toolNames = getTools().map((t: any) => t.name);
    const expected = [
      'security_audit',
      'check_reputation',
      'ssl_check',
      'test_delivery',
      'check_rate_limit',
      'search_accounts',
      'validate_forwarders',
      'cleanup_audit',
      'health_check',
      'password_audit',
      'analyze_headers',
      'export_config',
      'list_templates',
      'save_template',
      'send_template',
      'delete_template',
      'usage_history',
    ];
    for (const tool of expected) {
      expect(toolNames, `Missing tool: ${tool}`).toContain(tool);
    }
  });

  it('security_audit should exist with description', () => {
    const tool = getTools().find((t: any) => t.name === 'security_audit');
    expect(tool).toBeDefined();
    expect(tool.description).toContain('security audit');
  });

  it('template tools should have correct schemas', () => {
    const saveTool = getTools().find((t: any) => t.name === 'save_template');
    expect(saveTool).toBeDefined();
    const saveProps = saveTool.inputSchema.properties;
    expect(saveProps.name).toBeDefined();
    expect(saveProps.subject).toBeDefined();
    expect(saveProps.body).toBeDefined();

    const sendTool = getTools().find((t: any) => t.name === 'send_template');
    expect(sendTool).toBeDefined();
    const sendProps = sendTool.inputSchema.properties;
    expect(sendProps.template).toBeDefined();
    expect(sendProps.to).toBeDefined();
    expect(sendProps.variables).toBeDefined();
  });

  it('should have all business provisioning MCP tools', () => {
    const toolNames = getTools().map((t: any) => t.name);
    const expected = [
      'self_service_password',
      'provision_plan',
      'provision_execute',
      'provision_generate',
      'welcome_send',
      'credentials_export',
      'deprovision_account',
      'quota_policy_apply',
    ];
    for (const tool of expected) {
      expect(toolNames, `Missing tool: ${tool}`).toContain(tool);
    }
  });

  it('provision_execute should accept manifest with domains/accounts/forwarders', () => {
    const tool = getTools().find((t: any) => t.name === 'provision_execute');
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties;
    expect(props.manifest).toBeDefined();
  });

  it('welcome_send should accept to, company_name, and profile', () => {
    const tool = getTools().find((t: any) => t.name === 'welcome_send');
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties;
    expect(props.to).toBeDefined();
    expect(props.company_name).toBeDefined();
    expect(props.profile).toBeDefined();
  });

  it('deprovision_account should accept domain, username, action, forward_to', () => {
    const tool = getTools().find((t: any) => t.name === 'deprovision_account');
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties;
    expect(props.domain).toBeDefined();
    expect(props.username).toBeDefined();
    expect(props.action).toBeDefined();
    expect(props.action.enum).toContain('forward');
    expect(props.action.enum).toContain('delete');
    expect(props.forward_to).toBeDefined();
  });

  it('quota_policy_apply should accept domain and rules', () => {
    const tool = getTools().find((t: any) => t.name === 'quota_policy_apply');
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties;
    expect(props.domain).toBeDefined();
    expect(props.quota_mb).toBeDefined();
    expect(props.rules).toBeDefined();
  });

  it('credentials_export should accept domain and format', () => {
    const tool = getTools().find((t: any) => t.name === 'credentials_export');
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties;
    expect(props.domain).toBeDefined();
    expect(props.format).toBeDefined();
    expect(props.format.enum).toContain('json');
    expect(props.format.enum).toContain('csv');
    expect(props.format.enum).toContain('1password');
  });

  it('should have more than 75 tools total', () => {
    expect(getTools().length).toBeGreaterThan(75);
  });
});
