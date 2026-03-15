import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/auth');

describe('Auth Module', () => {
  it('should export authStatus as a function', () => {
    expect(typeof mod.authStatus).toBe('function');
  });

  it('should export authLogout as a function', () => {
    expect(typeof mod.authLogout).toBe('function');
  });
});
