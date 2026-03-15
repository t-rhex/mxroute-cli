import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/mail');

describe('Mail Module', () => {
  it('should export mailInbox as a function', () => {
    expect(typeof mod.mailInbox).toBe('function');
  });

  it('should export mailRead as a function', () => {
    expect(typeof mod.mailRead).toBe('function');
  });

  it('should export mailCompose as a function', () => {
    expect(typeof mod.mailCompose).toBe('function');
  });

  it('should export mailReply as a function', () => {
    expect(typeof mod.mailReply).toBe('function');
  });

  it('should export mailForward as a function', () => {
    expect(typeof mod.mailForward).toBe('function');
  });

  it('should export mailDelete as a function', () => {
    expect(typeof mod.mailDelete).toBe('function');
  });

  it('should export mailSearch as a function', () => {
    expect(typeof mod.mailSearch).toBe('function');
  });

  it('should export mailFolders as a function', () => {
    expect(typeof mod.mailFolders).toBe('function');
  });

  it('should export mailFolderCreate as a function', () => {
    expect(typeof mod.mailFolderCreate).toBe('function');
  });

  it('should export mailFolderDelete as a function', () => {
    expect(typeof mod.mailFolderDelete).toBe('function');
  });

  it('should export mailMove as a function', () => {
    expect(typeof mod.mailMove).toBe('function');
  });

  it('should export mailSaveAttachment as a function', () => {
    expect(typeof mod.mailSaveAttachment).toBe('function');
  });

  it('should export mailUnread as a function', () => {
    expect(typeof mod.mailUnread).toBe('function');
  });

  it('should export mailMarkRead as a function', () => {
    expect(typeof mod.mailMarkRead).toBe('function');
  });

  it('should export mailMarkUnread as a function', () => {
    expect(typeof mod.mailMarkUnread).toBe('function');
  });

  it('should not expose internal helpers', () => {
    expect(mod.sendViaSMTP).toBeUndefined();
    expect(mod.getImapConfig).toBeUndefined();
    expect(mod.withImap).toBeUndefined();
    expect(mod.formatDate).toBeUndefined();
    expect(mod.truncate).toBeUndefined();
    expect(mod.extractEmail).toBeUndefined();
    expect(mod.extractName).toBeUndefined();
  });
});
