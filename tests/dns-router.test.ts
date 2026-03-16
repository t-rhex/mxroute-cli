import { describe, it, expect, beforeAll } from 'vitest';

describe('DNS Router', () => {
  let router: any;

  beforeAll(async () => {
    router = await import('../dist/utils/dns-router');
  });

  describe('isMxrouteAuthority', () => {
    it('should return true for mxrouting.net nameservers', () => {
      expect(router.isMxrouteAuthority(['ns1.mxrouting.net', 'ns2.mxrouting.net'], 'tuesday')).toBe(true);
    });

    it('should return true when nameserver includes the server name', () => {
      expect(router.isMxrouteAuthority(['tuesday.mxrouting.net'], 'tuesday')).toBe(true);
    });

    it('should return false for Cloudflare nameservers', () => {
      expect(router.isMxrouteAuthority(['abby.ns.cloudflare.com', 'bob.ns.cloudflare.com'], 'tuesday')).toBe(false);
    });

    it('should return false for empty nameservers', () => {
      expect(router.isMxrouteAuthority([], 'tuesday')).toBe(false);
    });

    it('should handle trailing dots', () => {
      expect(router.isMxrouteAuthority(['ns1.mxrouting.net.'], 'tuesday')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(router.isMxrouteAuthority(['NS1.MXROUTING.NET'], 'tuesday')).toBe(true);
    });
  });

  describe('getProviderCreds', () => {
    it('should return null when no providers configured', () => {
      // getProviderCreds reads from config file; with no providers key it returns null
      const result = router.getProviderCreds('nonexistent-provider');
      expect(result).toBeNull();
    });
  });

  describe('migrateConfig', () => {
    it('should be a function', () => {
      expect(typeof router.migrateConfig).toBe('function');
    });

    it('should not throw when called', () => {
      expect(() => router.migrateConfig()).not.toThrow();
    });
  });

  describe('RouteResult structure', () => {
    it('routeDnsAdd should return a RouteResult', async () => {
      // Use a domain that will fail NS resolution to test the error path
      const result = await router.routeDnsAdd('this-domain-does-not-exist-12345.invalid', {
        type: 'TXT',
        name: '@',
        value: 'test',
      });
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('method');
      expect(typeof result.success).toBe('boolean');
      expect(result.success).toBe(false);
    });

    it('routeDnsDelete should return a RouteResult', async () => {
      const result = await router.routeDnsDelete('this-domain-does-not-exist-12345.invalid', {
        type: 'TXT',
        name: '@',
        value: 'test',
      });
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('method');
      expect(result.success).toBe(false);
    });

    it('routeDnsList should return a RouteResult', async () => {
      const result = await router.routeDnsList('this-domain-does-not-exist-12345.invalid');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('method');
      expect(result.success).toBe(false);
    });
  });

  describe('exports', () => {
    it('should export routeDnsAdd', () => {
      expect(typeof router.routeDnsAdd).toBe('function');
    });

    it('should export routeDnsDelete', () => {
      expect(typeof router.routeDnsDelete).toBe('function');
    });

    it('should export routeDnsList', () => {
      expect(typeof router.routeDnsList).toBe('function');
    });

    it('should export migrateConfig', () => {
      expect(typeof router.migrateConfig).toBe('function');
    });

    it('should export getProviderCreds', () => {
      expect(typeof router.getProviderCreds).toBe('function');
    });

    it('should export isMxrouteAuthority', () => {
      expect(typeof router.isMxrouteAuthority).toBe('function');
    });
  });
});
