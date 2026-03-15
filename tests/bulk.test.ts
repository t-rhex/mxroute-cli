import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/bulk');

describe('Bulk Module', () => {
  it('should export bulkAccounts as a function', () => {
    expect(typeof mod.bulkAccounts).toBe('function');
  });

  it('should export bulkForwarders as a function', () => {
    expect(typeof mod.bulkForwarders).toBe('function');
  });

  it('should not export internal CSV helpers', () => {
    expect(mod.parseCsvLine).toBeUndefined();
    expect(mod.parseCsv).toBeUndefined();
  });
});
