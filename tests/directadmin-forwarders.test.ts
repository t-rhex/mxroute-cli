import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const fetchModulePath = require.resolve('node-fetch');
require(fetchModulePath);
require.cache[fetchModulePath]!.exports = fetchMock;

const { getForwarderDestination } = require('../dist/utils/directadmin');

describe('DirectAdmin forwarder responses', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('extracts destinations from an object-shaped response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ hello: ['andrew@voyagerslab.com'] }),
    });

    const destination = await getForwarderDestination(
      { server: 'fusion.mxrouting.net', username: 'test', loginKey: 'test' },
      'voyagerslab.com',
      'hello',
    );

    expect(destination).toBe('andrew@voyagerslab.com');
  });
});
