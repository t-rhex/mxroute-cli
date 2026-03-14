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

describe('MCP Server', () => {
  it('should list tools', () => {
    const response = mcpRequest('tools/list');
    expect(response).toBeDefined();
    expect(response.result).toBeDefined();
    expect(response.result.tools).toBeDefined();
    expect(response.result.tools.length).toBeGreaterThan(30);
  });

  it('should have all expected tools', () => {
    const response = mcpRequest('tools/list');
    const toolNames = response.result.tools.map((t: any) => t.name);
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

  it('each tool should have description and schema', () => {
    const response = mcpRequest('tools/list');
    for (const tool of response.result.tools) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(5);
      expect(tool.inputSchema).toBeDefined();
    }
  });
});
