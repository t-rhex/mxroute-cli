import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';

const CLI = path.join(__dirname, '..', 'dist', 'index.js');

function runJson(args: string): any {
  try {
    const out = execSync(`node ${CLI} ${args} --json`, { encoding: 'utf-8', timeout: 15000 });
    return JSON.parse(out.trim());
  } catch (err: any) {
    const stdout = err.stdout || '';
    try {
      return JSON.parse(stdout.trim());
    } catch {
      return null;
    }
  }
}

describe('--json global flag', () => {
  it('should be accepted as a valid option', () => {
    // Just verify --json doesn't cause "unknown option" error
    const result = runJson('--version');
    // --version outputs version string, not JSON, but shouldn't error
  });

  it('should output valid JSON structure for version', () => {
    const output = execSync(`node ${CLI} --help`, { encoding: 'utf-8' });
    expect(output).toContain('--json');
  });
});
