import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';

const CLI = path.join(__dirname, '..', 'dist', 'index.js');

function run(args: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, { encoding: 'utf-8', timeout: 10000 }).trim();
  } catch (err: any) {
    return (err.stdout || '') + (err.stderr || '');
  }
}

describe('Share Command', () => {
  it('should show share in help', () => {
    const output = run('--help');
    expect(output).toContain('share');
  });

  it('should show share help', () => {
    const output = run('share --help');
    expect(output).toContain('setup instructions');
  });
});
