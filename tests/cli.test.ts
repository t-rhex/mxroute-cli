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

describe('CLI Integration', () => {
  it('should show version', () => {
    const output = run('--version');
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should show help with all main commands', () => {
    const output = run('--help');
    expect(output).toContain('Commands:');
    const commands = [
      'setup',
      'status',
      'config',
      'send',
      'dns',
      'info',
      'auth',
      'domains',
      'accounts',
      'forwarders',
      'autoresponder',
      'catchall',
      'spam',
      'doctor',
      'filters',
      'lists',
      'aliases',
      'quota',
      'troubleshoot',
      'test',
    ];
    for (const cmd of commands) {
      expect(output).toContain(cmd);
    }
  });

  it('should show config subcommands', () => {
    const output = run('config --help');
    expect(output).toContain('setup');
    expect(output).toContain('show');
    expect(output).toContain('profiles');
  });

  it('should show dns subcommands', () => {
    const output = run('dns --help');
    expect(output).toContain('check');
    expect(output).toContain('records');
    expect(output).toContain('generate');
  });

  it('should show info subcommands', () => {
    const output = run('info --help');
    expect(output).toContain('connections');
    expect(output).toContain('webmail');
    expect(output).toContain('caldav');
    expect(output).toContain('client');
  });

  it('should show send options', () => {
    const output = run('send --help');
    expect(output).toContain('--to');
    expect(output).toContain('--subject');
    expect(output).toContain('--body');
  });

  it('should display info connections with ports', () => {
    const output = run('info connections');
    expect(output).toContain('993');
    expect(output).toContain('465');
    expect(output).toContain('IMAP');
    expect(output).toContain('SMTP');
  });

  it('should display info limits', () => {
    const output = run('info limits');
    expect(output).toContain('400');
  });

  it('should display info panels', () => {
    const output = run('info panels');
    expect(output).toContain('management.mxroute.com');
    expect(output).toContain('panel.mxroute.com');
  });

  it('should display info caldav', () => {
    const output = run('info caldav');
    expect(output).toContain('dav.mxroute.com');
  });

  it('should show client setup guides', () => {
    expect(run('info client ios')).toContain('993');
    expect(run('info client outlook')).toContain('IMAP');
    expect(run('info client thunderbird')).toContain('SMTP');
  });
});
