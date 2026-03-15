import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/rate-limit');

describe('RateLimit Module', () => {
  it('should export recordSend as a function', () => {
    expect(typeof mod.recordSend).toBe('function');
  });

  it('should export rateLimitCommand as a function', () => {
    expect(typeof mod.rateLimitCommand).toBe('function');
  });

  it('rateLimitCommand should be async', () => {
    expect(mod.rateLimitCommand.constructor.name).toBe('AsyncFunction');
  });

  it('should not expose internal helpers', () => {
    expect(mod.loadSendLog).toBeUndefined();
    expect(mod.pruneOldEntries).toBeUndefined();
    expect(mod.getRateFilePath).toBeUndefined();
  });
});
