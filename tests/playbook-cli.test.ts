import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

describe('Playbook CLI', () => {
  const tmpFile = path.join(os.tmpdir(), 'test-playbook.yml');

  beforeAll(() => {
    fs.writeFileSync(
      tmpFile,
      'name: Test Playbook\nsteps:\n  - name: Check DNS\n    action: dns.check\n    args:\n      domain: example.com',
    );
  });

  afterAll(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it('should show playbook in help', () => {
    expect(run('--help')).toContain('playbook');
  });

  it('should show playbook subcommands', () => {
    const output = run('playbook --help');
    expect(output).toContain('run');
    expect(output).toContain('validate');
    expect(output).toContain('list');
  });

  it('should validate a valid playbook', () => {
    const output = run(`playbook validate ${tmpFile}`);
    expect(output).toContain('valid');
  });

  it('should handle missing file', () => {
    const output = run('playbook validate /tmp/nonexistent.yml');
    expect(output).toContain('not found');
  });

  it('should run dry-run', () => {
    const output = run(`playbook run ${tmpFile} --dry-run`);
    expect(output).toContain('DRY RUN');
    expect(output).toContain('Check DNS');
  });
});
