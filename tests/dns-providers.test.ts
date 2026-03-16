import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';
const CLI = path.join(__dirname, '..', 'dist', 'index.js');
function run(args: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, { encoding: 'utf-8', timeout: 15000 }).trim();
  } catch (err: any) {
    return (err.stdout || '') + (err.stderr || '');
  }
}

describe('DNS Providers Command', () => {
  it('should show providers in dns help', () => {
    expect(run('dns --help')).toContain('providers');
  });

  it('dns providers should list all 9 providers', () => {
    const output = run('dns providers');
    expect(output).toContain('Cloudflare');
    expect(output).toContain('Porkbun');
    expect(output).toContain('DigitalOcean');
    expect(output).toContain('Namecheap');
    expect(output).toContain('Route53');
    expect(output).toContain('Google');
    expect(output).toContain('GoDaddy');
    expect(output).toContain('Hetzner');
    expect(output).toContain('Vercel');
  });
});
