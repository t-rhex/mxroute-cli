import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/deprovision');

describe('Deprovision Module', () => {
  it('should export deprovisionAccount', () => {
    expect(mod.deprovisionAccount).toBeDefined();
  });

  it('deprovisionAccount should be a function', () => {
    expect(typeof mod.deprovisionAccount).toBe('function');
  });
});
