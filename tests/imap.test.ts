import { describe, it, expect } from 'vitest';

const { ImapClient } = require('../dist/utils/imap');

describe('IMAP Client', () => {
  describe('constructor', () => {
    it('should create a client with config', () => {
      const client = new ImapClient({
        host: 'mail.example.com',
        port: 993,
        user: 'test@example.com',
        password: 'secret',
      });
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(ImapClient);
    });
  });

  describe('decodeHeader', () => {
    it('should decode Base64 encoded headers', () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      const encoded = `=?utf-8?B?${Buffer.from('Hello World').toString('base64')}?=`;
      expect(client.decodeHeader(encoded)).toBe('Hello World');
    });

    it('should decode Q-encoded headers', () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      expect(client.decodeHeader('=?utf-8?Q?Hello_World?=')).toBe('Hello World');
    });

    it('should decode Q-encoded headers with hex sequences', () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      expect(client.decodeHeader('=?utf-8?Q?=48ello?=')).toBe('Hello');
    });

    it('should pass through non-encoded values', () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      expect(client.decodeHeader('Plain text')).toBe('Plain text');
    });

    it('should handle empty strings', () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      expect(client.decodeHeader('')).toBe('');
    });

    it('should handle multiple encoded words', () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      const part1 = `=?utf-8?B?${Buffer.from('Hello').toString('base64')}?=`;
      const part2 = `=?utf-8?B?${Buffer.from(' World').toString('base64')}?=`;
      expect(client.decodeHeader(`${part1} ${part2}`)).toBe('Hello  World');
    });
  });

  describe('disconnect', () => {
    it('should handle disconnect when not connected', () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      // Should not throw
      client.disconnect();
    });
  });

  describe('connection errors', () => {
    it('should throw on login when not connected', async () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      await expect(client.login()).rejects.toThrow('Not connected');
    });

    it('should throw on listFolders when not connected', async () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      await expect(client.listFolders()).rejects.toThrow('Not connected');
    });

    it('should throw on selectFolder when not connected', async () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      await expect(client.selectFolder('INBOX')).rejects.toThrow('Not connected');
    });

    it('should throw on search when not connected', async () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      await expect(client.search('ALL')).rejects.toThrow('Not connected');
    });

    it('should throw on fetchBody when not connected', async () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      await expect(client.fetchBody(1)).rejects.toThrow('Not connected');
    });

    it('should throw on setFlags when not connected', async () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      await expect(client.setFlags(1, '\\Seen')).rejects.toThrow('Not connected');
    });
  });

  describe('fetchEnvelopes', () => {
    it('should return empty array for start <= 0', async () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      const result = await client.fetchEnvelopes(0, 10);
      expect(result).toEqual([]);
    });
  });

  describe('fetchEnvelopesByUid', () => {
    it('should return empty array for empty uids', async () => {
      const client = new ImapClient({ host: '', port: 0, user: '', password: '' });
      const result = await client.fetchEnvelopesByUid([]);
      expect(result).toEqual([]);
    });
  });
});
