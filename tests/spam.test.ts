import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/spam');

describe('Spam Module', () => {
  it('should export spamStatus as a function', () => {
    expect(typeof mod.spamStatus).toBe('function');
  });

  it('should export spamEnable as a function', () => {
    expect(typeof mod.spamEnable).toBe('function');
  });

  it('should export spamDisable as a function', () => {
    expect(typeof mod.spamDisable).toBe('function');
  });

  it('should export spamConfig as a function', () => {
    expect(typeof mod.spamConfig).toBe('function');
  });
});
