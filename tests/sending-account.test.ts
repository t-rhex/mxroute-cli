import { describe, it, expect, beforeAll } from 'vitest';

describe('Sending Account Module', () => {
  let mod: any;

  beforeAll(async () => {
    mod = await import('../dist/utils/sending-account');
  });

  it('should export hasSendingAccount', () => {
    expect(typeof mod.hasSendingAccount).toBe('function');
  });

  it('should export getSendingAccountSync', () => {
    expect(typeof mod.getSendingAccountSync).toBe('function');
  });

  it('should export getSendingAccount', () => {
    expect(typeof mod.getSendingAccount).toBe('function');
  });

  it('hasSendingAccount returns boolean', () => {
    const result = mod.hasSendingAccount();
    expect(typeof result).toBe('boolean');
  });

  it('getSendingAccountSync returns object or null', () => {
    const result = mod.getSendingAccountSync();
    if (result) {
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('password');
      expect(result).toHaveProperty('server');
    } else {
      expect(result).toBeNull();
    }
  });
});
