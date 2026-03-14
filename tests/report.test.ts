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
describe('Report Command', () => {
  it('should show report in help', () => {
    expect(run('--help')).toContain('report');
  });
  it('should show report help', () => {
    expect(run('report --help')).toContain('infrastructure');
  });
});
