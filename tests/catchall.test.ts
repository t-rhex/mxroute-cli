import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/catchall');

describe('CatchAll Module', () => {
  it('should export catchallGet as a function', () => {
    expect(typeof mod.catchallGet).toBe('function');
  });

  it('should export catchallSet as a function', () => {
    expect(typeof mod.catchallSet).toBe('function');
  });
});
