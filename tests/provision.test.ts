import { describe, it, expect } from 'vitest';

const mod = require('../dist/commands/provision');
const { generatePassword } = mod;

describe('Provision Module', () => {
  describe('generatePassword', () => {
    it('should generate a 16-character password', () => {
      const pw = generatePassword();
      expect(pw).toHaveLength(16);
    });

    it('should generate unique passwords', () => {
      const passwords = new Set<string>();
      for (let i = 0; i < 50; i++) {
        passwords.add(generatePassword());
      }
      expect(passwords.size).toBe(50);
    });

    it('should contain mixed character types', () => {
      const pw = generatePassword();
      // At minimum should have some alphanumeric chars
      expect(pw).toMatch(/[a-zA-Z]/);
      expect(pw).toMatch(/[0-9]/);
    });

    it('should not contain whitespace', () => {
      for (let i = 0; i < 20; i++) {
        const pw = generatePassword();
        expect(pw).not.toMatch(/\s/);
      }
    });
  });

  it('should export provisionPlan as a function', () => {
    expect(mod.provisionPlan).toBeDefined();
    expect(typeof mod.provisionPlan).toBe('function');
  });

  it('should export provisionExecute as a function', () => {
    expect(mod.provisionExecute).toBeDefined();
    expect(typeof mod.provisionExecute).toBe('function');
  });

  it('should export provisionGenerate as a function', () => {
    expect(mod.provisionGenerate).toBeDefined();
    expect(typeof mod.provisionGenerate).toBe('function');
  });
});
