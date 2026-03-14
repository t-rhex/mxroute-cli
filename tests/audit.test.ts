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

describe('Audit Command', () => {
  it('should show audit in help', () => {
    const output = run('--help');
    expect(output).toContain('audit');
  });

  it('should show audit help', () => {
    const output = run('audit --help');
    expect(output).toContain('Security audit');
  });
});
