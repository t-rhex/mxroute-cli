import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/send');

describe('Send Module', () => {
  it('should export sendCommand as a function', () => {
    expect(typeof mod.sendCommand).toBe('function');
  });
});
