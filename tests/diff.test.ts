import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CLI = path.join(__dirname, '..', 'dist', 'index.js');

function run(args: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, { encoding: 'utf-8', timeout: 10000 }).trim();
  } catch (err: any) {
    return (err.stdout || '') + (err.stderr || '');
  }
}

describe('Diff Command', () => {
  const tmpDir = path.join(os.tmpdir(), 'mxroute-diff-test-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should show diff in help', () => {
    expect(run('--help')).toContain('diff');
  });

  it('should detect no differences for identical exports', () => {
    const data = {
      version: '1',
      exportedAt: '2026-01-01',
      domain: 'test.com',
      accounts: [{ user: 'alice' }],
      forwarders: [],
      autoresponders: [],
      catchAll: ':fail:',
    };
    const f1 = path.join(tmpDir, 'a.json');
    const f2 = path.join(tmpDir, 'b.json');
    fs.writeFileSync(f1, JSON.stringify(data));
    fs.writeFileSync(f2, JSON.stringify(data));

    const output = run(`diff ${f1} ${f2}`);
    expect(output).toContain('No differences');
  });

  it('should detect added accounts', () => {
    const d1 = {
      version: '1',
      exportedAt: '2026-01-01',
      domain: 'test.com',
      accounts: [{ user: 'alice' }],
      forwarders: [],
      autoresponders: [],
      catchAll: ':fail:',
    };
    const d2 = { ...d1, accounts: [{ user: 'alice' }, { user: 'bob' }] };
    const f1 = path.join(tmpDir, 'a.json');
    const f2 = path.join(tmpDir, 'b.json');
    fs.writeFileSync(f1, JSON.stringify(d1));
    fs.writeFileSync(f2, JSON.stringify(d2));

    const output = run(`diff ${f1} ${f2}`);
    expect(output).toContain('bob');
    expect(output).toContain('1 change');
  });

  it('should detect removed accounts', () => {
    const d1 = {
      version: '1',
      exportedAt: '2026-01-01',
      domain: 'test.com',
      accounts: [{ user: 'alice' }, { user: 'bob' }],
      forwarders: [],
      autoresponders: [],
      catchAll: '',
    };
    const d2 = { ...d1, accounts: [{ user: 'alice' }] };
    const f1 = path.join(tmpDir, 'a.json');
    const f2 = path.join(tmpDir, 'b.json');
    fs.writeFileSync(f1, JSON.stringify(d1));
    fs.writeFileSync(f2, JSON.stringify(d2));

    const output = run(`diff ${f1} ${f2}`);
    expect(output).toContain('bob');
  });

  it('should detect catch-all changes', () => {
    const d1 = {
      version: '1',
      exportedAt: '2026-01-01',
      domain: 'test.com',
      accounts: [],
      forwarders: [],
      autoresponders: [],
      catchAll: ':fail:',
    };
    const d2 = { ...d1, catchAll: 'admin@test.com' };
    const f1 = path.join(tmpDir, 'a.json');
    const f2 = path.join(tmpDir, 'b.json');
    fs.writeFileSync(f1, JSON.stringify(d1));
    fs.writeFileSync(f2, JSON.stringify(d2));

    const output = run(`diff ${f1} ${f2}`);
    expect(output).toContain('Catch-All');
  });
});
