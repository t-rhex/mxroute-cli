import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/credentials-export');

describe('CredentialsExport Module', () => {
  it('should export credentialsExport', () => {
    expect(mod.credentialsExport).toBeDefined();
  });

  it('credentialsExport should be a function', () => {
    expect(typeof mod.credentialsExport).toBe('function');
  });

  it('should export credentialsExportData', () => {
    expect(mod.credentialsExportData).toBeDefined();
  });

  it('credentialsExportData should be a function', () => {
    expect(typeof mod.credentialsExportData).toBe('function');
  });
});
