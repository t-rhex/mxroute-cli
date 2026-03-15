import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/welcome-send');

describe('WelcomeSend Module', () => {
  it('should export welcomeSend', () => {
    expect(mod.welcomeSend).toBeDefined();
  });

  it('welcomeSend should be a function', () => {
    expect(typeof mod.welcomeSend).toBe('function');
  });

  it('should export welcomeSendBulk', () => {
    expect(mod.welcomeSendBulk).toBeDefined();
  });

  it('welcomeSendBulk should be a function', () => {
    expect(typeof mod.welcomeSendBulk).toBe('function');
  });
});
