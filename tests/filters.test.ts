import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/filters');

describe('Filters Module', () => {
  it('should export filtersList as a function', () => {
    expect(typeof mod.filtersList).toBe('function');
  });

  it('should export filtersCreate as a function', () => {
    expect(typeof mod.filtersCreate).toBe('function');
  });

  it('should export filtersDelete as a function', () => {
    expect(typeof mod.filtersDelete).toBe('function');
  });
});
