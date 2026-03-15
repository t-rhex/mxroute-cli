import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/status');

describe('Status Module', () => {
  it('should export statusCommand as a function', () => {
    expect(typeof mod.statusCommand).toBe('function');
  });

  it('should have statusCommand as the only export', () => {
    const keys = Object.keys(mod);
    expect(keys).toContain('statusCommand');
    expect(keys.length).toBe(1);
  });

  it('statusCommand should return a promise when called would be async', () => {
    expect(mod.statusCommand.constructor.name).toBe('AsyncFunction');
  });
});
