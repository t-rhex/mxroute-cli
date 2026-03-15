import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/domains');

describe('Domains Module', () => {
  it('should export domainsList as a function', () => {
    expect(typeof mod.domainsList).toBe('function');
  });

  it('should export domainsInfo as a function', () => {
    expect(typeof mod.domainsInfo).toBe('function');
  });
});
