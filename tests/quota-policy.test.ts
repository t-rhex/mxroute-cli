import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/quota-policy');

describe('QuotaPolicy Module', () => {
  it('should export quotaPolicyApply', () => {
    expect(mod.quotaPolicyApply).toBeDefined();
  });

  it('quotaPolicyApply should be a function', () => {
    expect(typeof mod.quotaPolicyApply).toBe('function');
  });

  it('should export quotaPolicyGenerate', () => {
    expect(mod.quotaPolicyGenerate).toBeDefined();
  });

  it('quotaPolicyGenerate should be a function', () => {
    expect(typeof mod.quotaPolicyGenerate).toBe('function');
  });

  it('should export matchPattern', () => {
    expect(mod.matchPattern).toBeDefined();
  });

  it('matchPattern should be a function', () => {
    expect(typeof mod.matchPattern).toBe('function');
  });

  describe('matchPattern', () => {
    it('should match exact string', () => {
      expect(mod.matchPattern('admin', 'admin')).toBe(true);
    });

    it('should match wildcard *', () => {
      expect(mod.matchPattern('admin', '*')).toBe(true);
    });

    it('should match prefix wildcard', () => {
      expect(mod.matchPattern('admin', 'admin*')).toBe(true);
    });

    it('should not match non-matching prefix', () => {
      expect(mod.matchPattern('user', 'admin*')).toBe(false);
    });

    it('should match longer string with prefix wildcard', () => {
      expect(mod.matchPattern('admin-backup', 'admin*')).toBe(true);
    });

    it('should match single-char prefix wildcard', () => {
      expect(mod.matchPattern('alice', 'a*')).toBe(true);
    });

    it('should not match wrong prefix', () => {
      expect(mod.matchPattern('bob', 'a*')).toBe(false);
    });
  });
});
