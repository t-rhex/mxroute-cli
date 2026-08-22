import { describe, expect, it, vi } from 'vitest';

describe('management backend selection', () => {
  it('shares rate-limit state across equivalent current API credentials', () => {
    const { createManagementClient } = require('../dist/utils/management');
    const credentials = {
      backend: 'mxroute-api',
      server: 'eagle.mxlogin.com',
      username: 'owner',
      apiKey: 'Mx_shared',
    };

    expect(createManagementClient(credentials)).toBe(createManagementClient({ ...credentials }));
  });

  it('uses the current MXroute API for supported operations', async () => {
    const api = { listDomains: vi.fn().mockResolvedValue(['example.com']) };
    const legacy = { listDomains: vi.fn() };
    const { createManagementClient } = require('../dist/utils/management');
    const client = createManagementClient(
      { backend: 'mxroute-api', server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { api, legacy },
    );

    await expect(client.listDomains()).resolves.toEqual(['example.com']);
    expect(api.listDomains).toHaveBeenCalledOnce();
    expect(legacy.listDomains).not.toHaveBeenCalled();
  });

  it('does not silently fall back when a current API operation fails', async () => {
    const api = { listDomains: vi.fn().mockRejectedValue(new Error('API unavailable')) };
    const legacy = { listDomains: vi.fn().mockResolvedValue(['stale.example']) };
    const { createManagementClient } = require('../dist/utils/management');
    const client = createManagementClient(
      {
        backend: 'mxroute-api',
        server: 'eagle.mxlogin.com',
        username: 'owner',
        apiKey: 'Mx_test',
        legacy: { server: 'fusion', username: 'owner', loginKey: 'legacy' },
      },
      { api, legacy },
    );

    await expect(client.listDomains()).rejects.toThrow('API unavailable');
    expect(legacy.listDomains).not.toHaveBeenCalled();
  });

  it('requires explicit legacy credentials for unsupported operations', async () => {
    const { createManagementClient } = require('../dist/utils/management');
    const client = createManagementClient({
      backend: 'mxroute-api',
      server: 'eagle.mxlogin.com',
      username: 'owner',
      apiKey: 'Mx_test',
    });

    await expect(client.listAutoresponders('example.com')).rejects.toMatchObject({
      name: 'ManagementCapabilityError',
      capability: 'autoresponders',
    });
  });

  it('normalizes current API forwarders for existing callers', async () => {
    const api = {
      listForwarders: vi
        .fn()
        .mockResolvedValue([{ alias: 'hello', destinations: ['owner@example.com', 'archive@example.com'] }]),
    };
    const { createManagementClient } = require('../dist/utils/management');
    const client = createManagementClient(
      { backend: 'mxroute-api', server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { api },
    );

    await expect(client.listForwarders('example.com')).resolves.toEqual(['hello']);
    await expect(client.getForwarderDestination('example.com', 'hello')).resolves.toBe(
      'owner@example.com,archive@example.com',
    );
  });

  it('uses legacy credentials only for unsupported features', async () => {
    const listAutoresponders = vi.fn().mockResolvedValue(['away']);
    const { createManagementClient } = require('../dist/utils/management');
    const client = createManagementClient(
      {
        backend: 'mxroute-api',
        server: 'eagle.mxlogin.com',
        username: 'owner',
        apiKey: 'Mx_test',
        legacy: { server: 'fusion', username: 'legacy-owner', loginKey: 'legacy-key' },
      },
      { legacy: { listAutoresponders } },
    );

    await expect(client.listAutoresponders('example.com')).resolves.toEqual(['away']);
    expect(listAutoresponders).toHaveBeenCalledWith(
      { server: 'fusion', username: 'legacy-owner', loginKey: 'legacy-key' },
      'example.com',
    );
  });

  it('normalizes current quota bytes and resource counts for existing views', async () => {
    const api = {
      getQuota: vi.fn().mockResolvedValue({ total_used: 1_572_864, total_limit: 104_857_600 }),
      listDomains: vi.fn().mockResolvedValue(['one.example', 'two.example']),
      listEmailAccounts: vi
        .fn()
        .mockResolvedValueOnce([{ username: 'a' }, { username: 'b' }])
        .mockResolvedValueOnce([{ username: 'c' }]),
      listForwarders: vi
        .fn()
        .mockResolvedValueOnce([{ alias: 'sales', destinations: ['a@one.example'] }])
        .mockResolvedValueOnce([]),
    };
    const { createManagementClient } = require('../dist/utils/management');
    const client = createManagementClient(
      { backend: 'mxroute-api', server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { api },
    );

    await expect(client.getQuotaUsage()).resolves.toMatchObject({ quota: 1.5, vdomains: 2, nemails: 3, nemailf: 1 });
    await expect(client.getUserConfig()).resolves.toMatchObject({ quota: 100 });
  });
});
