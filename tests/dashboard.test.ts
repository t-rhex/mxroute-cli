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

describe('Dashboard Command', () => {
  it('should show dashboard in help', () => {
    expect(run('--help')).toContain('dashboard');
  });

  it('should show dash alias in help', () => {
    expect(run('--help')).toContain('dash');
  });
});
