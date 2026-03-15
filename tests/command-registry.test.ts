import { describe, it, expect, beforeAll } from 'vitest';

describe('Command Registry', () => {
  let registry: any;

  beforeAll(async () => {
    registry = await import('../dist/utils/command-registry');
  });

  it('should have at least 8 categories', () => {
    expect(Object.keys(registry.categories).length).toBeGreaterThanOrEqual(8);
  });

  it('should have examples for dns check', () => {
    expect(registry.commandExamples['dns check']).toBeDefined();
    expect(registry.commandExamples['dns check'].examples.length).toBeGreaterThan(0);
  });

  it('should have examples for accounts list', () => {
    expect(registry.commandExamples['accounts list']).toBeDefined();
  });

  it('findCategory should match by exact name', () => {
    const result = registry.findCategory('DNS & Deliverability');
    expect(result).toBeDefined();
    expect(result.commands).toContain('dns');
  });

  it('findCategory should match partial/fuzzy', () => {
    const result = registry.findCategory('dns');
    expect(result).toBeDefined();
  });

  it('findCategory should match by keyword', () => {
    const result = registry.findCategory('email');
    expect(result).toBeDefined();
  });

  it('findCommand should return command info', () => {
    const result = registry.findCommand('dns check');
    expect(result).toBeDefined();
    expect(result.examples.length).toBeGreaterThan(0);
    expect(result.related.length).toBeGreaterThan(0);
  });

  it('getAllCommands should return a flat array', () => {
    const all = registry.getAllCommands();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(30);
  });

  it('findCommand should return null for unknown', () => {
    expect(registry.findCommand('nonexistent xyz')).toBeNull();
  });
});
