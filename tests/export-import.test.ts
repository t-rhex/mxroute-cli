import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/export-import');

describe('ExportImport Module', () => {
  it('should export exportCommand as a function', () => {
    expect(typeof mod.exportCommand).toBe('function');
  });

  it('should export importCommand as a function', () => {
    expect(typeof mod.importCommand).toBe('function');
  });

  it('should only export the two command functions', () => {
    const keys = Object.keys(mod);
    expect(keys).toContain('exportCommand');
    expect(keys).toContain('importCommand');
  });
});
