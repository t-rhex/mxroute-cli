import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/cleanup');

describe('Cleanup Module', () => {
  it('should export cleanupCommand as a function', () => {
    expect(typeof mod.cleanupCommand).toBe('function');
  });

  it('cleanupCommand should be async', () => {
    expect(mod.cleanupCommand.constructor.name).toBe('AsyncFunction');
  });

  it('should not expose internal resolveMx helper', () => {
    expect(mod.resolveMx).toBeUndefined();
  });

  it('should have cleanupCommand as the only export', () => {
    const keys = Object.keys(mod);
    expect(keys).toContain('cleanupCommand');
    expect(keys.length).toBe(1);
  });
});
