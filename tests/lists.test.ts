import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/lists');

describe('Lists Module', () => {
  it('should export mailingListsList as a function', () => {
    expect(typeof mod.mailingListsList).toBe('function');
  });

  it('should export mailingListsCreate as a function', () => {
    expect(typeof mod.mailingListsCreate).toBe('function');
  });

  it('should export mailingListsDelete as a function', () => {
    expect(typeof mod.mailingListsDelete).toBe('function');
  });

  it('should export mailingListsMembers as a function', () => {
    expect(typeof mod.mailingListsMembers).toBe('function');
  });

  it('should export mailingListsAddMember as a function', () => {
    expect(typeof mod.mailingListsAddMember).toBe('function');
  });

  it('should export mailingListsRemoveMember as a function', () => {
    expect(typeof mod.mailingListsRemoveMember).toBe('function');
  });
});
