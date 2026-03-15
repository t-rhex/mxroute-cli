import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/ssl-check');

describe('SslCheck Module', () => {
  it('should export sslCheckCommand as a function', () => {
    expect(typeof mod.sslCheckCommand).toBe('function');
  });

  it('should not expose the internal checkCert helper', () => {
    expect(mod.checkCert).toBeUndefined();
  });

  it('sslCheckCommand should be async', () => {
    expect(mod.sslCheckCommand.constructor.name).toBe('AsyncFunction');
  });

  it('should have sslCheckCommand as the only export', () => {
    const keys = Object.keys(mod);
    expect(keys).toContain('sslCheckCommand');
    expect(keys.length).toBe(1);
  });
});
