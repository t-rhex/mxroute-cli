import { describe, it, expect, beforeAll } from 'vitest';

describe('GoDaddy Provider', () => {
  let gd: any;
  beforeAll(async () => {
    gd = (await import('../../dist/providers/godaddy')).godaddy;
  });

  it('should have correct id', () => {
    expect(gd.id).toBe('godaddy');
  });
  it('should have correct name', () => {
    expect(gd.name).toBe('GoDaddy');
  });
  it('should have nsPatterns including domaincontrol.com', () => {
    expect(gd.nsPatterns).toContain('domaincontrol.com');
  });
  it('should have credentialFields for apiKey and apiSecret', () => {
    expect(gd.credentialFields.length).toBe(2);
    expect(gd.credentialFields.map((f: any) => f.name)).toContain('apiKey');
    expect(gd.credentialFields.map((f: any) => f.name)).toContain('apiSecret');
  });
  it('apiKey field should be secret', () => {
    const f = gd.credentialFields.find((f: any) => f.name === 'apiKey');
    expect(f.secret).toBe(true);
  });
  it('apiSecret field should be secret', () => {
    const f = gd.credentialFields.find((f: any) => f.name === 'apiSecret');
    expect(f.secret).toBe(true);
  });
  it('validateCredentials rejects empty', () => {
    expect(gd.validateCredentials({})).not.toBeNull();
  });
  it('validateCredentials rejects missing apiSecret', () => {
    expect(gd.validateCredentials({ apiKey: 'key' })).not.toBeNull();
  });
  it('validateCredentials rejects missing apiKey', () => {
    expect(gd.validateCredentials({ apiSecret: 'secret' })).not.toBeNull();
  });
  it('validateCredentials accepts valid creds', () => {
    expect(gd.validateCredentials({ apiKey: 'key', apiSecret: 'secret' })).toBeNull();
  });
  it('authenticate returns false for invalid creds', async () => {
    expect(await gd.authenticate({ apiKey: 'invalid', apiSecret: 'invalid' })).toBe(false);
  });
});

describe('Hetzner DNS Provider', () => {
  let hz: any;
  beforeAll(async () => {
    hz = (await import('../../dist/providers/hetzner')).hetzner;
  });

  it('should have correct id', () => {
    expect(hz.id).toBe('hetzner');
  });
  it('should have correct name', () => {
    expect(hz.name).toBe('Hetzner DNS');
  });
  it('should have nsPatterns including hetzner.com', () => {
    expect(hz.nsPatterns).toContain('hetzner.com');
  });
  it('should have nsPatterns including hetzner.de', () => {
    expect(hz.nsPatterns).toContain('hetzner.de');
  });
  it('should have credentialFields for apiKey', () => {
    expect(hz.credentialFields.length).toBe(1);
    expect(hz.credentialFields[0].name).toBe('apiKey');
  });
  it('apiKey field should be secret', () => {
    expect(hz.credentialFields[0].secret).toBe(true);
  });
  it('validateCredentials rejects empty', () => {
    expect(hz.validateCredentials({})).not.toBeNull();
  });
  it('validateCredentials accepts valid creds', () => {
    expect(hz.validateCredentials({ apiKey: 'token' })).toBeNull();
  });
  it('authenticate returns false for invalid creds', async () => {
    expect(await hz.authenticate({ apiKey: 'invalid' })).toBe(false);
  });
});

describe('Vercel DNS Provider', () => {
  let vc: any;
  beforeAll(async () => {
    vc = (await import('../../dist/providers/vercel')).vercel;
  });

  it('should have correct id', () => {
    expect(vc.id).toBe('vercel');
  });
  it('should have correct name', () => {
    expect(vc.name).toBe('Vercel DNS');
  });
  it('should have nsPatterns including vercel-dns.com', () => {
    expect(vc.nsPatterns).toContain('vercel-dns.com');
  });
  it('should have credentialFields for apiKey', () => {
    expect(vc.credentialFields.length).toBe(1);
    expect(vc.credentialFields[0].name).toBe('apiKey');
  });
  it('apiKey field should be secret', () => {
    expect(vc.credentialFields[0].secret).toBe(true);
  });
  it('validateCredentials rejects empty', () => {
    expect(vc.validateCredentials({})).not.toBeNull();
  });
  it('validateCredentials accepts valid creds', () => {
    expect(vc.validateCredentials({ apiKey: 'token' })).toBeNull();
  });
  it('authenticate returns false for invalid creds', async () => {
    expect(await vc.authenticate({ apiKey: 'invalid' })).toBe(false);
  });
});

describe('AWS Route53 Provider (detection-only)', () => {
  let r53: any;
  beforeAll(async () => {
    r53 = (await import('../../dist/providers/route53')).route53;
  });

  it('should have correct id', () => {
    expect(r53.id).toBe('route53');
  });
  it('should have correct name', () => {
    expect(r53.name).toBe('AWS Route53');
  });
  it('should have nsPatterns including awsdns', () => {
    expect(r53.nsPatterns).toContain('awsdns');
  });
  it('should have credentialFields for apiKey, apiSecret, and region', () => {
    expect(r53.credentialFields.length).toBe(3);
    expect(r53.credentialFields.map((f: any) => f.name)).toContain('apiKey');
    expect(r53.credentialFields.map((f: any) => f.name)).toContain('apiSecret');
    expect(r53.credentialFields.map((f: any) => f.name)).toContain('region');
  });
  it('apiKey field should not be secret', () => {
    const f = r53.credentialFields.find((f: any) => f.name === 'apiKey');
    expect(f.secret).toBe(false);
  });
  it('apiSecret field should be secret', () => {
    const f = r53.credentialFields.find((f: any) => f.name === 'apiSecret');
    expect(f.secret).toBe(true);
  });
  it('validateCredentials rejects empty', () => {
    expect(r53.validateCredentials({})).not.toBeNull();
  });
  it('validateCredentials rejects missing apiSecret', () => {
    expect(r53.validateCredentials({ apiKey: 'key', region: 'us-east-1' })).not.toBeNull();
  });
  it('validateCredentials rejects missing region', () => {
    expect(r53.validateCredentials({ apiKey: 'key', apiSecret: 'secret' })).not.toBeNull();
  });
  it('validateCredentials accepts valid creds', () => {
    expect(r53.validateCredentials({ apiKey: 'key', apiSecret: 'secret', region: 'us-east-1' })).toBeNull();
  });
  it('authenticate returns false (detection-only, cannot validate)', async () => {
    expect(await r53.authenticate({ apiKey: 'key', apiSecret: 'secret', region: 'us-east-1' })).toBe(false);
  });
  it('createRecord returns success false with helpful message', async () => {
    const result = await r53.createRecord({ apiKey: 'key', apiSecret: 'secret', region: 'us-east-1' }, 'example.com', {
      type: 'MX',
      name: '@',
      value: 'mail.example.com',
      priority: 10,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Route53');
  });
  it('deleteRecord returns success false with helpful message', async () => {
    const result = await r53.deleteRecord({ apiKey: 'key', apiSecret: 'secret', region: 'us-east-1' }, 'example.com', {
      type: 'MX',
      name: '@',
      value: 'mail.example.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Route53');
  });
});

describe('Google Cloud DNS Provider (detection-only)', () => {
  let gcp: any;
  beforeAll(async () => {
    gcp = (await import('../../dist/providers/google')).google;
  });

  it('should have correct id', () => {
    expect(gcp.id).toBe('google');
  });
  it('should have correct name', () => {
    expect(gcp.name).toBe('Google Cloud DNS');
  });
  it('should have nsPatterns including ns-cloud', () => {
    expect(gcp.nsPatterns).toContain('ns-cloud');
  });
  it('should have credentialFields for serviceAccountPath and projectId', () => {
    expect(gcp.credentialFields.length).toBe(2);
    expect(gcp.credentialFields.map((f: any) => f.name)).toContain('serviceAccountPath');
    expect(gcp.credentialFields.map((f: any) => f.name)).toContain('projectId');
  });
  it('serviceAccountPath field should not be secret', () => {
    const f = gcp.credentialFields.find((f: any) => f.name === 'serviceAccountPath');
    expect(f.secret).toBe(false);
  });
  it('projectId field should not be secret', () => {
    const f = gcp.credentialFields.find((f: any) => f.name === 'projectId');
    expect(f.secret).toBe(false);
  });
  it('validateCredentials rejects empty', () => {
    expect(gcp.validateCredentials({})).not.toBeNull();
  });
  it('validateCredentials rejects missing projectId', () => {
    expect(gcp.validateCredentials({ serviceAccountPath: '/path/to/sa.json' })).not.toBeNull();
  });
  it('validateCredentials rejects missing serviceAccountPath', () => {
    expect(gcp.validateCredentials({ projectId: 'my-project' })).not.toBeNull();
  });
  it('validateCredentials accepts valid creds', () => {
    expect(gcp.validateCredentials({ serviceAccountPath: '/path/to/sa.json', projectId: 'my-project' })).toBeNull();
  });
  it('authenticate returns false (detection-only, cannot validate)', async () => {
    expect(await gcp.authenticate({ serviceAccountPath: '/path/to/sa.json', projectId: 'my-project' })).toBe(false);
  });
  it('createRecord returns success false with helpful message', async () => {
    const result = await gcp.createRecord(
      { serviceAccountPath: '/path/to/sa.json', projectId: 'my-project' },
      'example.com',
      { type: 'MX', name: '@', value: 'mail.example.com', priority: 10 },
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('Google Cloud DNS');
  });
  it('deleteRecord returns success false with helpful message', async () => {
    const result = await gcp.deleteRecord(
      { serviceAccountPath: '/path/to/sa.json', projectId: 'my-project' },
      'example.com',
      { type: 'MX', name: '@', value: 'mail.example.com' },
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('Google Cloud DNS');
  });
});
