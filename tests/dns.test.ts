import { describe, it, expect } from 'vitest';
import { checkSpfRecord, checkDkimRecord, checkDmarcRecord, checkMxRecords } from '../dist/utils/dns';

describe('DNS Module', () => {
  describe('checkSpfRecord', () => {
    it('should check SPF for a known domain', async () => {
      const result = await checkSpfRecord('google.com');
      expect(result.type).toBe('SPF');
      expect(result.status).toBeDefined();
      expect(['pass', 'fail', 'warn']).toContain(result.status);
    });

    it('should fail for non-existent domain', async () => {
      const result = await checkSpfRecord('thisdomain-definitely-does-not-exist-12345.com');
      expect(result.status).toBe('fail');
    });
  });

  describe('checkDkimRecord', () => {
    it('should return result with correct type', async () => {
      const result = await checkDkimRecord('example.com');
      expect(result.type).toBe('DKIM');
      expect(result.name).toContain('x._domainkey');
    });
  });

  describe('checkDmarcRecord', () => {
    it('should check DMARC for a known domain', async () => {
      const result = await checkDmarcRecord('google.com');
      expect(result.type).toBe('DMARC');
      // Google has DMARC
      expect(result.status).toBe('pass');
    });

    it('should return warn for domain without DMARC', async () => {
      const result = await checkDmarcRecord('thisdomain-definitely-does-not-exist-12345.com');
      expect(['warn', 'fail']).toContain(result.status);
    });
  });

  describe('checkMxRecords', () => {
    it('should return correct structure', async () => {
      const result = await checkMxRecords('google.com', 'nonexistent');
      expect(result.type).toBe('MX');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('expected');
      expect(result).toHaveProperty('actual');
      expect(result).toHaveProperty('message');
    });
  });
});
