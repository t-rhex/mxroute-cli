import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/accounts');

describe('Accounts Module', () => {
  it('should export accountsList as a function', () => {
    expect(typeof mod.accountsList).toBe('function');
  });

  it('should export accountsCreate as a function', () => {
    expect(typeof mod.accountsCreate).toBe('function');
  });

  it('should export accountsDelete as a function', () => {
    expect(typeof mod.accountsDelete).toBe('function');
  });

  it('should export accountsPasswd as a function', () => {
    expect(typeof mod.accountsPasswd).toBe('function');
  });
});
