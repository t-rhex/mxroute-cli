import { describe, it, expect } from 'vitest';

describe('Provider Types', () => {
  it('should export type definitions', async () => {
    const types = await import('../../dist/providers/types');
    expect(types).toBeDefined();
  });
});
