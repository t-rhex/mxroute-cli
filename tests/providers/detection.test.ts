import { describe, it, expect, beforeAll } from 'vitest';

describe('Provider Registry', () => {
  let reg: any;
  beforeAll(async () => {
    reg = await import('../../dist/providers/index');
  });

  it('should export registerProvider', () => {
    expect(typeof reg.registerProvider).toBe('function');
  });

  it('should export getProvider', () => {
    expect(typeof reg.getProvider).toBe('function');
  });

  it('should export listProviders', () => {
    expect(typeof reg.listProviders).toBe('function');
    expect(Array.isArray(reg.listProviders())).toBe(true);
  });

  it('should export detectProvider', () => {
    expect(typeof reg.detectProvider).toBe('function');
  });

  it('detectProvider should return null for unknown nameservers', () => {
    expect(reg.detectProvider(['ns1.random-host.net'])).toBeNull();
  });

  it('should register and detect a test provider', () => {
    const testProvider = {
      id: 'test-provider',
      name: 'Test',
      nsPatterns: ['test-ns.example.com'],
      credentialFields: [],
      validateCredentials: () => null,
      authenticate: async () => true,
      listZones: async () => [],
      listRecords: async () => [],
      createRecord: async () => ({ success: true, message: 'ok' }),
      deleteRecord: async () => ({ success: true, message: 'ok' }),
    };
    reg.registerProvider(testProvider);
    expect(reg.getProvider('test-provider')).toBeDefined();
    expect(reg.detectProvider(['ns1.test-ns.example.com'])).not.toBeNull();
    expect(reg.detectProvider(['ns1.test-ns.example.com']).id).toBe('test-provider');
  });

  it('detectProvider should handle trailing dots', () => {
    expect(reg.detectProvider(['ns1.test-ns.example.com.'])).not.toBeNull();
  });
});
