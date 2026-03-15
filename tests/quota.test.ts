import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/quota');

describe('Quota Module', () => {
  it('should export quotaOverview as a function', () => {
    expect(typeof mod.quotaOverview).toBe('function');
  });

  it('should export quotaSet as a function', () => {
    expect(typeof mod.quotaSet).toBe('function');
  });

  it('should not export internal helpers like buildBar or formatSize', () => {
    expect(mod.buildBar).toBeUndefined();
    expect(mod.formatSize).toBeUndefined();
  });
});
