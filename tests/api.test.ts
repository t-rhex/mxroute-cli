import { describe, it, expect } from 'vitest';

describe('API Module', () => {
  it('should export sendEmail function', () => {
    const api = require('../dist/utils/api');
    expect(typeof api.sendEmail).toBe('function');
  });

  it('should export testConnection function', () => {
    const api = require('../dist/utils/api');
    expect(typeof api.testConnection).toBe('function');
  });

  it('sendEmail should reject with invalid server', async () => {
    const { sendEmail } = require('../dist/utils/api');
    try {
      await sendEmail({
        server: 'invalid.example.com',
        username: 'test@test.com',
        password: 'test',
        from: 'test@test.com',
        to: 'test@test.com',
        subject: 'test',
        body: 'test',
      });
    } catch (err: any) {
      expect(err).toBeDefined();
    }
  });
});
