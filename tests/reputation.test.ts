import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/reputation');

describe('Reputation Module', () => {
  it('should export reputationCommand as a function', () => {
    expect(typeof mod.reputationCommand).toBe('function');
  });

  it('reputationCommand should be async', () => {
    expect(mod.reputationCommand.constructor.name).toBe('AsyncFunction');
  });

  it('should not expose internal DNS helpers', () => {
    expect(mod.resolveTxt).toBeUndefined();
    expect(mod.resolveA).toBeUndefined();
    expect(mod.resolveMx).toBeUndefined();
  });

  it('should have reputationCommand as the only export', () => {
    const keys = Object.keys(mod);
    expect(keys).toContain('reputationCommand');
    expect(keys.length).toBe(1);
  });
});
