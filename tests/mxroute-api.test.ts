import { describe, expect, it, vi } from 'vitest';

describe('MXroute API client', () => {
  it('lists domains with API-key authentication headers', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ success: true, data: ['example.com'] }),
    });
    const { createMXrouteApiClient } = require('../dist/utils/mxroute-api');
    const client = createMXrouteApiClient(
      { server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { fetch, writeIntervalMs: 0 },
    );

    await expect(client.listDomains()).resolves.toEqual(['example.com']);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.mxroute.com/domains',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          'X-API-Key': 'Mx_test',
          'X-Server': 'eagle.mxlogin.com',
          'X-Username': 'owner',
        }),
      }),
    );
  });

  it('exposes structured API errors without leaking credentials', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: () => null },
      text: async () => JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }),
    });
    const { createMXrouteApiClient } = require('../dist/utils/mxroute-api');
    const client = createMXrouteApiClient(
      { server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_secret' },
      { fetch, writeIntervalMs: 0 },
    );

    await expect(client.listDomains()).rejects.toMatchObject({
      name: 'MXrouteApiError',
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid API key',
    });
    await expect(client.listDomains()).rejects.not.toThrow('Mx_secret');
  });

  it('returns structured forwarders from one list request', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () =>
        JSON.stringify({
          success: true,
          data: [{ alias: 'hello', email: 'hello@example.com', destinations: ['owner@example.com'] }],
        }),
    });
    const { createMXrouteApiClient } = require('../dist/utils/mxroute-api');
    const client = createMXrouteApiClient(
      { server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { fetch, writeIntervalMs: 0 },
    );

    await expect(client.listForwarders('example.com')).resolves.toEqual([
      { alias: 'hello', email: 'hello@example.com', destinations: ['owner@example.com'] },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.mxroute.com/domains/example.com/forwarders');
  });

  it('serializes writes and accepts empty 204 responses', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => null },
        text: async () => JSON.stringify({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => null },
        text: async () => '',
      });
    const { createMXrouteApiClient } = require('../dist/utils/mxroute-api');
    const client = createMXrouteApiClient(
      { server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { fetch, writeIntervalMs: 0 },
    );

    await client.createForwarder('example.com', 'sales', ['owner@example.com']);
    await client.deleteForwarder('example.com', 'sales');

    expect(fetch.mock.calls[0]).toEqual([
      'https://api.mxroute.com/domains/example.com/forwarders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ alias: 'sales', destinations: ['owner@example.com'] }),
      }),
    ]);
    expect(fetch.mock.calls[1][0]).toBe('https://api.mxroute.com/domains/example.com/forwarders/sales');
    expect(fetch.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'DELETE' }));
  });

  it('supports the mailbox lifecycle with structured account data', async () => {
    const responses = [
      { success: true, data: [{ username: 'andrew', email: 'andrew@example.com', quota: 0 }] },
      { success: true },
      { success: true },
      undefined,
    ];
    const fetch = vi.fn().mockImplementation(async () => {
      const body = responses.shift();
      return {
        ok: true,
        status: body === undefined ? 204 : 200,
        headers: { get: () => null },
        text: async () => (body === undefined ? '' : JSON.stringify(body)),
      };
    });
    const { createMXrouteApiClient } = require('../dist/utils/mxroute-api');
    const client = createMXrouteApiClient(
      { server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { fetch, writeIntervalMs: 0 },
    );

    await expect(client.listEmailAccounts('example.com')).resolves.toEqual([
      { username: 'andrew', email: 'andrew@example.com', quota: 0 },
    ]);
    await client.createEmailAccount('example.com', { username: 'new', password: 'Secure123', quota: 0 });
    await client.updateEmailAccount('example.com', 'new', { quota: 2048 });
    await client.deleteEmailAccount('example.com', 'new');

    expect(fetch.mock.calls.map((call) => [call[0], call[1].method, call[1].body])).toEqual([
      ['https://api.mxroute.com/domains/example.com/email-accounts', 'GET', undefined],
      [
        'https://api.mxroute.com/domains/example.com/email-accounts',
        'POST',
        JSON.stringify({ username: 'new', password: 'Secure123', quota: 0 }),
      ],
      ['https://api.mxroute.com/domains/example.com/email-accounts/new', 'PATCH', JSON.stringify({ quota: 2048 })],
      ['https://api.mxroute.com/domains/example.com/email-accounts/new', 'DELETE', undefined],
    ]);
  });

  it('reads domain settings and unwrapped quota responses', async () => {
    const responses = [
      { success: true, data: { domain: 'example.com', mail_hosting: true, pointers: [] } },
      { success: true, data: [{ pointer: 'alias.com', type: 'alias', target: 'example.com' }] },
      { success: true, data: { type: 'fail', address: null } },
      { success: true, data: { dkim: { type: 'TXT', name: 'x._domainkey', value: 'v=DKIM1; p=key' } } },
      { total_used: 1024, total_limit: 2048, percent_used: 50 },
    ];
    const fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify(responses.shift()),
    }));
    const { createMXrouteApiClient } = require('../dist/utils/mxroute-api');
    const client = createMXrouteApiClient(
      { server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { fetch },
    );

    await expect(client.getDomain('example.com')).resolves.toMatchObject({ domain: 'example.com' });
    await expect(client.listDomainPointers('example.com')).resolves.toEqual([
      { pointer: 'alias.com', type: 'alias', target: 'example.com' },
    ]);
    await expect(client.getCatchAll('example.com')).resolves.toEqual({ type: 'fail', address: null });
    await expect(client.getDnsInfo('example.com')).resolves.toMatchObject({
      dkim: { value: 'v=DKIM1; p=key' },
    });
    await expect(client.getQuota()).resolves.toEqual({ total_used: 1024, total_limit: 2048, percent_used: 50 });
  });

  it('retries rate-limited reads using Retry-After', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? '2' : null) },
        text: async () => JSON.stringify({ success: false, error: { code: 'RATE_LIMITED', message: 'Try again' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ success: true, data: ['example.com'] }),
      });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const { createMXrouteApiClient } = require('../dist/utils/mxroute-api');
    const client = createMXrouteApiClient(
      { server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { fetch, sleep },
    );

    await expect(client.listDomains()).resolves.toEqual(['example.com']);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('paces writes to the documented 20-per-minute limit', async () => {
    let now = 1_000;
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => null },
      text: async () => JSON.stringify({ success: true }),
    });
    const sleep = vi.fn().mockImplementation(async (milliseconds: number) => {
      now += milliseconds;
    });
    const { createMXrouteApiClient } = require('../dist/utils/mxroute-api');
    const client = createMXrouteApiClient(
      { server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { fetch, sleep, now: () => now },
    );

    await client.createForwarder('example.com', 'one', ['owner@example.com']);
    await client.createForwarder('example.com', 'two', ['owner@example.com']);

    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it('bounds reads within the documented rate-limit window', async () => {
    let now = 1_000;
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ success: true, data: ['example.com'] }),
    });
    const sleep = vi.fn().mockImplementation(async (milliseconds: number) => {
      now += milliseconds;
    });
    const { createMXrouteApiClient } = require('../dist/utils/mxroute-api');
    const client = createMXrouteApiClient(
      { server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { fetch, sleep, now: () => now, readLimitPerMinute: 1 },
    );

    await client.listDomains();
    await client.listDomains();

    expect(sleep).toHaveBeenCalledWith(60_000);
  });

  it('counts retry attempts against the read limit', async () => {
    let now = 1_000;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        headers: { get: () => null },
        text: async () => JSON.stringify({ success: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ success: true, data: ['example.com'] }),
      });
    const sleep = vi.fn().mockImplementation(async (milliseconds: number) => {
      now += milliseconds;
    });
    const { createMXrouteApiClient } = require('../dist/utils/mxroute-api');
    const client = createMXrouteApiClient(
      { server: 'eagle.mxlogin.com', username: 'owner', apiKey: 'Mx_test' },
      { fetch, sleep, now: () => now, readLimitPerMinute: 1 },
    );

    await expect(client.listDomains()).resolves.toEqual(['example.com']);
    expect(sleep.mock.calls).toEqual([[1000], [59_000]]);
  });
});
