import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/templates');

describe('Templates Module', () => {
  it('should export templatesList as a function', () => {
    expect(typeof mod.templatesList).toBe('function');
  });

  it('should export templatesSave as a function', () => {
    expect(typeof mod.templatesSave).toBe('function');
  });

  it('should export templatesSend as a function', () => {
    expect(typeof mod.templatesSend).toBe('function');
  });

  it('should export templatesDelete as a function', () => {
    expect(typeof mod.templatesDelete).toBe('function');
  });

  it('should not expose internal helpers', () => {
    expect(mod.loadTemplate).toBeUndefined();
    expect(mod.saveTemplate).toBeUndefined();
    expect(mod.extractVariables).toBeUndefined();
    expect(mod.replaceVariables).toBeUndefined();
  });
});
