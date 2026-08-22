import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const fetchModulePath = require.resolve('node-fetch');
require(fetchModulePath);
require.cache[fetchModulePath]!.exports = fetchMock;

const {
  createEmailFilter,
  createMailingList,
  deleteEmailFilter,
  listEmailFilters,
} = require('../dist/utils/directadmin');

const credentials = { server: 'fusion', username: 'test', loginKey: 'test' };

describe('DirectAdmin email filter responses', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns only the domain filter rules from the response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          filters: { 0: { type: 'word', value: 'blocked phrase' } },
          high_score: '15',
          high_score_block: 'yes',
          where: 'delete',
        }),
    });

    await expect(listEmailFilters(credentials, 'example.com')).resolves.toEqual([
      { id: '0', type: 'word', value: 'blocked phrase' },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://fusion.mxrouting.net:2222/CMD_API_EMAIL_FILTER?domain=example.com&json=yes',
    );
  });

  it('uses DirectAdmin domain filter fields when creating a rule', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ success: 'Filter set', id: '0' }) });

    await createEmailFilter(credentials, 'example.com', 'word', 'blocked phrase');

    const options = fetchMock.mock.calls[0][1];
    expect(options.body).toBe('action=add&domain=example.com&type=word&value=blocked+phrase');
  });

  it('deletes a domain filter by its DirectAdmin id', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ success: 'Filter deleted' }) });

    await deleteEmailFilter(credentials, 'example.com', '7');

    const options = fetchMock.mock.calls[0][1];
    expect(options.body).toBe('action=delete&domain=example.com&select0=7');
  });

  it('includes DirectAdmin error details for failed requests', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () =>
        JSON.stringify({
          error: 'Cannot Create Another Mailing List',
          result: 'Your reseller has reached their assigned limit',
        }),
    });

    await expect(createMailingList(credentials, 'example.com', 'news')).rejects.toThrow(
      'Cannot Create Another Mailing List: Your reseller has reached their assigned limit',
    );
  });
});
