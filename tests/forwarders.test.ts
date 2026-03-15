import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/forwarders');

describe('Forwarders Module', () => {
  it('should export forwardersList as a function', () => {
    expect(typeof mod.forwardersList).toBe('function');
  });

  it('should export forwardersCreate as a function', () => {
    expect(typeof mod.forwardersCreate).toBe('function');
  });

  it('should export forwardersDelete as a function', () => {
    expect(typeof mod.forwardersDelete).toBe('function');
  });
});
