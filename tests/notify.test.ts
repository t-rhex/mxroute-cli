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
describe('Notify Command', () => {
  it('should show notify in help', () => {
    expect(run('--help')).toContain('notify');
  });
  it('should show notify subcommands', () => {
    const output = run('notify --help');
    expect(output).toContain('setup');
    expect(output).toContain('test');
  });
});
