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

describe('Guide Command', () => {
  it('should show guide in help', () => {
    expect(run('--help')).toContain('guide');
  });

  it('should show DNS topic details', () => {
    const output = run('guide dns');
    expect(output).toContain('dns');
    expect(output).toContain('Commands');
  });

  it('should show command details for dns check', () => {
    const output = run('guide "dns check"');
    expect(output).toContain('Examples');
  });

  it('should handle unknown topics', () => {
    const output = run('guide nonexistent');
    expect(output).toContain('not found');
  });
});
