import { describe, it, expect, beforeAll } from 'vitest';

describe('Porkbun Provider', () => {
  let pb: any;
  beforeAll(async () => {
    pb = (await import('../../dist/providers/porkbun')).porkbun;
  });

  it('should have correct id', () => {
    expect(pb.id).toBe('porkbun');
  });
  it('should have nsPatterns', () => {
    expect(pb.nsPatterns).toContain('porkbun.com');
  });
  it('should have credentialFields for apiKey and apiSecret', () => {
    expect(pb.credentialFields.length).toBe(2);
    expect(pb.credentialFields.map((f: any) => f.name)).toContain('apiKey');
    expect(pb.credentialFields.map((f: any) => f.name)).toContain('apiSecret');
  });
  it('validateCredentials rejects empty', () => {
    expect(pb.validateCredentials({})).not.toBeNull();
  });
  it('validateCredentials rejects missing apiSecret', () => {
    expect(pb.validateCredentials({ apiKey: 'key' })).not.toBeNull();
  });
  it('validateCredentials accepts valid', () => {
    expect(pb.validateCredentials({ apiKey: 'key', apiSecret: 'secret' })).toBeNull();
  });
  it('authenticate returns false for invalid', async () => {
    expect(await pb.authenticate({ apiKey: 'invalid', apiSecret: 'invalid' })).toBe(false);
  });
});

describe('DigitalOcean Provider', () => {
  let do_: any;
  beforeAll(async () => {
    do_ = (await import('../../dist/providers/digitalocean')).digitalocean;
  });

  it('should have correct id', () => {
    expect(do_.id).toBe('digitalocean');
  });
  it('should have nsPatterns', () => {
    expect(do_.nsPatterns).toContain('digitalocean.com');
  });
  it('should have credentialFields', () => {
    expect(do_.credentialFields.length).toBe(1);
    expect(do_.credentialFields[0].name).toBe('apiKey');
  });
  it('validateCredentials rejects empty', () => {
    expect(do_.validateCredentials({})).not.toBeNull();
  });
  it('validateCredentials accepts valid', () => {
    expect(do_.validateCredentials({ apiKey: 'token' })).toBeNull();
  });
  it('authenticate returns false for invalid', async () => {
    expect(await do_.authenticate({ apiKey: 'invalid' })).toBe(false);
  });
});

describe('Namecheap Provider', () => {
  let nc: any;
  beforeAll(async () => {
    nc = (await import('../../dist/providers/namecheap')).namecheap;
  });

  it('should have correct id', () => {
    expect(nc.id).toBe('namecheap');
  });
  it('should have nsPatterns including registrar-servers.com', () => {
    expect(nc.nsPatterns).toContain('registrar-servers.com');
  });
  it('should have nsPatterns including namecheaphosting.com', () => {
    expect(nc.nsPatterns).toContain('namecheaphosting.com');
  });
  it('should have credentialFields for apiKey and username', () => {
    expect(nc.credentialFields.length).toBe(2);
    expect(nc.credentialFields.map((f: any) => f.name)).toContain('apiKey');
    expect(nc.credentialFields.map((f: any) => f.name)).toContain('username');
  });
  it('validateCredentials rejects empty', () => {
    expect(nc.validateCredentials({})).not.toBeNull();
  });
  it('validateCredentials accepts valid', () => {
    expect(nc.validateCredentials({ apiKey: 'key', username: 'user' })).toBeNull();
  });
  it('createRecord returns success false with atomic message', async () => {
    const result = await nc.createRecord({ apiKey: 'k', username: 'u' }, 'example.com', {
      type: 'MX',
      name: '@',
      value: 'mail.example.com',
      priority: 10,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('atomically');
  });
  it('deleteRecord returns success false with atomic message', async () => {
    const result = await nc.deleteRecord({ apiKey: 'k', apiSecret: 'u' }, 'example.com', {
      type: 'MX',
      name: '@',
      value: 'mail.example.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('atomically');
  });
});
