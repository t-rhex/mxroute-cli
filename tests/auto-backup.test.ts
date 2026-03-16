import { describe, it, expect, beforeAll } from 'vitest';

describe('Auto Backup', () => {
  let mod: any;
  beforeAll(async () => {
    mod = await import('../dist/utils/auto-backup');
  });

  it('should export snapshotBeforeDelete', () => {
    expect(typeof mod.snapshotBeforeDelete).toBe('function');
  });

  it('should export listBackups', () => {
    expect(typeof mod.listBackups).toBe('function');
  });

  it('listBackups returns array', () => {
    expect(Array.isArray(mod.listBackups())).toBe(true);
  });
});
