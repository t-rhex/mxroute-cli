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

describe('Completions Command', () => {
  it('should show completions in help', () => {
    expect(run('--help')).toContain('completions');
  });

  it('should generate bash completions', () => {
    const output = run('completions bash');
    expect(output).toContain('_mxroute');
    expect(output).toContain('complete');
    expect(output).toContain('COMPREPLY');
  });

  it('should generate zsh completions', () => {
    const output = run('completions zsh');
    expect(output).toContain('compdef');
    expect(output).toContain('_mxroute');
  });

  it('should generate fish completions', () => {
    const output = run('completions fish');
    expect(output).toContain('complete -c mxroute');
  });

  it('completions should include all major commands', () => {
    const output = run('completions bash');
    const commands = ['config', 'dns', 'accounts', 'domains', 'send', 'audit', 'monitor'];
    for (const cmd of commands) {
      expect(output).toContain(cmd);
    }
  });
});
