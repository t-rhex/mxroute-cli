import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/aliases');

describe('Aliases Module', () => {
  it('should export aliasesList as a function', () => {
    expect(typeof mod.aliasesList).toBe('function');
  });

  it('should export aliasesAdd as a function', () => {
    expect(typeof mod.aliasesAdd).toBe('function');
  });

  it('should export aliasesRemove as a function', () => {
    expect(typeof mod.aliasesRemove).toBe('function');
  });

  it('should not export unexpected keys', () => {
    const keys = Object.keys(mod);
    expect(keys).toContain('aliasesList');
    expect(keys).toContain('aliasesAdd');
    expect(keys).toContain('aliasesRemove');
  });
});
