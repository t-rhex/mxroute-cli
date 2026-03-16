import { describe, it, expect, beforeAll } from 'vitest';

describe('Activity Log', () => {
  let mod: any;
  beforeAll(async () => {
    mod = await import('../dist/utils/activity-log');
  });

  it('should export logActivity', () => {
    expect(typeof mod.logActivity).toBe('function');
  });
  it('should export getActivityLog', () => {
    expect(typeof mod.getActivityLog).toBe('function');
  });
  it('getActivityLog returns array', () => {
    expect(Array.isArray(mod.getActivityLog())).toBe(true);
  });
});
