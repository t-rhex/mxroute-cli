import { describe, it, expect } from 'vitest';

describe('DirectAdmin Module', () => {
  it('should export all domain functions', () => {
    const da = require('../dist/utils/directadmin');
    expect(typeof da.listDomains).toBe('function');
    expect(typeof da.getDomainInfo).toBe('function');
    expect(typeof da.listDomainPointers).toBe('function');
    expect(typeof da.addDomainPointer).toBe('function');
    expect(typeof da.deleteDomainPointer).toBe('function');
  });

  it('should export all email account functions', () => {
    const da = require('../dist/utils/directadmin');
    expect(typeof da.listEmailAccounts).toBe('function');
    expect(typeof da.createEmailAccount).toBe('function');
    expect(typeof da.deleteEmailAccount).toBe('function');
    expect(typeof da.changeEmailPassword).toBe('function');
    expect(typeof da.changeEmailQuota).toBe('function');
  });

  it('should export all forwarder functions', () => {
    const da = require('../dist/utils/directadmin');
    expect(typeof da.listForwarders).toBe('function');
    expect(typeof da.createForwarder).toBe('function');
    expect(typeof da.deleteForwarder).toBe('function');
    expect(typeof da.getForwarderDestination).toBe('function');
  });

  it('should export all autoresponder functions', () => {
    const da = require('../dist/utils/directadmin');
    expect(typeof da.listAutoresponders).toBe('function');
    expect(typeof da.createAutoresponder).toBe('function');
    expect(typeof da.deleteAutoresponder).toBe('function');
    expect(typeof da.getAutoresponder).toBe('function');
    expect(typeof da.modifyAutoresponder).toBe('function');
  });

  it('should export catch-all functions', () => {
    const da = require('../dist/utils/directadmin');
    expect(typeof da.getCatchAll).toBe('function');
    expect(typeof da.setCatchAll).toBe('function');
  });

  it('should export spam functions', () => {
    const da = require('../dist/utils/directadmin');
    expect(typeof da.getSpamConfig).toBe('function');
    expect(typeof da.setSpamConfig).toBe('function');
  });

  it('should export DNS functions', () => {
    const da = require('../dist/utils/directadmin');
    expect(typeof da.listDnsRecords).toBe('function');
    expect(typeof da.addDnsRecord).toBe('function');
    expect(typeof da.deleteDnsRecord).toBe('function');
    expect(typeof da.getDkimKey).toBe('function');
  });

  it('should export filter functions', () => {
    const da = require('../dist/utils/directadmin');
    expect(typeof da.listEmailFilters).toBe('function');
    expect(typeof da.createEmailFilter).toBe('function');
    expect(typeof da.deleteEmailFilter).toBe('function');
  });

  it('should export mailing list functions', () => {
    const da = require('../dist/utils/directadmin');
    expect(typeof da.listMailingLists).toBe('function');
    expect(typeof da.createMailingList).toBe('function');
    expect(typeof da.deleteMailingList).toBe('function');
    expect(typeof da.getMailingListMembers).toBe('function');
    expect(typeof da.addMailingListMember).toBe('function');
    expect(typeof da.removeMailingListMember).toBe('function');
  });

  it('should export auth functions', () => {
    const da = require('../dist/utils/directadmin');
    expect(typeof da.testAuth).toBe('function');
    expect(typeof da.getUserConfig).toBe('function');
    expect(typeof da.getQuotaUsage).toBe('function');
  });

  it('testAuth should fail with invalid credentials', async () => {
    const da = require('../dist/utils/directadmin');
    const result = await da.testAuth({
      server: 'invalid.example.com',
      username: 'test',
      loginKey: 'test',
    });
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });
});
