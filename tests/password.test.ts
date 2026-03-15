import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/password');

describe('Password Module', () => {
  it('should export selfServicePasswordChange', () => {
    expect(mod.selfServicePasswordChange).toBeDefined();
  });

  it('selfServicePasswordChange should be a function', () => {
    expect(typeof mod.selfServicePasswordChange).toBe('function');
  });
});
