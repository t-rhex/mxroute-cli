import { describe, it, expect, beforeAll } from 'vitest';

describe('Cloudflare Provider', () => {
  let cf: any;
  beforeAll(async () => {
    cf = (await import('../../dist/providers/cloudflare')).cloudflare;
  });

  it('should have correct id', () => {
    expect(cf.id).toBe('cloudflare');
  });
  it('should have nsPatterns', () => {
    expect(cf.nsPatterns).toContain('cloudflare.com');
  });
  it('should have credentialFields', () => {
    expect(cf.credentialFields.length).toBe(1);
    expect(cf.credentialFields[0].name).toBe('apiKey');
  });
  it('validateCredentials rejects empty', () => {
    expect(cf.validateCredentials({})).not.toBeNull();
  });
  it('validateCredentials accepts valid', () => {
    expect(cf.validateCredentials({ apiKey: 'token' })).toBeNull();
  });
  it('authenticate returns false for invalid', async () => {
    expect(await cf.authenticate({ apiKey: 'invalid' })).toBe(false);
  });
});
