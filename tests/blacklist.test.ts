import { describe, it, expect } from 'vitest';

describe('Blacklist Module', () => {
  it('should export all functions', () => {
    const bl = require('../dist/utils/blacklist');
    expect(typeof bl.resolveServerIp).toBe('function');
    expect(typeof bl.checkBlacklist).toBe('function');
    expect(typeof bl.checkAllBlacklists).toBe('function');
    expect(typeof bl.getBlacklistCount).toBe('function');
  });

  it('should have at least 8 blacklists configured', () => {
    const bl = require('../dist/utils/blacklist');
    expect(bl.getBlacklistCount()).toBeGreaterThanOrEqual(8);
  });

  it('should resolve a known hostname', async () => {
    const bl = require('../dist/utils/blacklist');
    const ip = await bl.resolveServerIp('google.com');
    expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it('should fail for non-existent hostname', async () => {
    const bl = require('../dist/utils/blacklist');
    await expect(bl.resolveServerIp('this-does-not-exist-12345.invalid')).rejects.toThrow();
  });

  it('should check a single blacklist', async () => {
    const bl = require('../dist/utils/blacklist');
    const result = await bl.checkBlacklist('8.8.8.8', { name: 'Test', zone: 'zen.spamhaus.org' });
    expect(result).toHaveProperty('list');
    expect(result).toHaveProperty('listed');
    expect(typeof result.listed).toBe('boolean');
  });

  it('should check all blacklists', async () => {
    const bl = require('../dist/utils/blacklist');
    const results = await bl.checkAllBlacklists('8.8.8.8');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(bl.getBlacklistCount());
    // Google's DNS should not be on most blacklists (allow minor false positives in CI)
    const listed = results.filter((r: any) => r.listed);
    expect(listed.length).toBeLessThanOrEqual(3);
  }, 15000);
});

describe('IP Check CLI', () => {
  it('should show ip in help', () => {
    const { execSync } = require('child_process');
    const path = require('path');
    const CLI = path.join(__dirname, '..', 'dist', 'index.js');
    const output = execSync(`node ${CLI} --help`, { encoding: 'utf-8' });
    expect(output).toContain('ip');
  });
});
