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

describe('Fix Command', () => {
  it('should show fix in help', () => {
    expect(run('--help')).toContain('fix');
  });

  it('should show fix help', () => {
    const output = run('fix --help');
    expect(output).toContain('Auto-fix');
  });
});
