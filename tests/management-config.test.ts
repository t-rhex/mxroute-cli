import { describe, expect, it } from 'vitest';

describe('management credential configuration', () => {
  it('keeps current API and legacy credentials distinct', () => {
    const { resolveManagementCredentials } = require('../dist/utils/shared');

    expect(
      resolveManagementCredentials({
        managementBackend: 'mxroute-api',
        apiServer: 'eagle.mxlogin.com',
        apiUsername: 'owner',
        apiKey: 'Mx_test',
        server: 'fusion',
        daUsername: 'legacy-owner',
        daLoginKey: 'legacy-key',
      }),
    ).toEqual({
      backend: 'mxroute-api',
      server: 'eagle.mxlogin.com',
      username: 'owner',
      apiKey: 'Mx_test',
      legacy: { server: 'fusion', username: 'legacy-owner', loginKey: 'legacy-key' },
    });
  });

  it('preserves DirectAdmin configuration for existing users', () => {
    const { resolveManagementCredentials } = require('../dist/utils/shared');

    expect(
      resolveManagementCredentials({
        managementBackend: 'directadmin',
        server: 'fusion',
        daUsername: 'owner',
        daLoginKey: 'legacy-key',
      }),
    ).toEqual({ server: 'fusion', username: 'owner', loginKey: 'legacy-key' });
  });
});
