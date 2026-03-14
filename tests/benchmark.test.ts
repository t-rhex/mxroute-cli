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

describe('Benchmark Command', () => {
  it('should show benchmark in help', () => {
    expect(run('--help')).toContain('benchmark');
  });

  it('should show benchmark help', () => {
    const output = run('benchmark --help');
    expect(output).toContain('connection speed');
  });
});
