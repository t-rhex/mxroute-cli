import { describe, it, expect } from 'vitest';
import { theme, stripAnsi } from '../dist/utils/theme';

describe('Theme Module', () => {
  describe('stripAnsi', () => {
    it('should strip ANSI escape codes', () => {
      const colored = '\x1B[31mhello\x1B[0m';
      expect(stripAnsi(colored)).toBe('hello');
    });

    it('should return plain text unchanged', () => {
      expect(stripAnsi('hello world')).toBe('hello world');
    });

    it('should handle empty string', () => {
      expect(stripAnsi('')).toBe('');
    });
  });

  describe('theme functions', () => {
    it('heading should contain the text', () => {
      const result = stripAnsi(theme.heading('Test'));
      expect(result).toContain('Test');
    });

    it('subheading should contain the text', () => {
      const result = stripAnsi(theme.subheading('Sub'));
      expect(result).toContain('Sub');
    });

    it('keyValue should format key and value', () => {
      const result = stripAnsi(theme.keyValue('Name', 'Value'));
      expect(result).toContain('Name');
      expect(result).toContain('Value');
    });

    it('statusIcon should return a string for each status', () => {
      expect(typeof theme.statusIcon('pass')).toBe('string');
      expect(typeof theme.statusIcon('fail')).toBe('string');
      expect(typeof theme.statusIcon('warn')).toBe('string');
      expect(typeof theme.statusIcon('info')).toBe('string');
    });

    it('banner should return multi-line string', () => {
      const banner = theme.banner();
      expect(banner).toContain('Email Hosting Management CLI');
      expect(banner.split('\n').length).toBeGreaterThan(1);
    });

    it('separator should return a line', () => {
      const sep = stripAnsi(theme.separator());
      expect(sep.length).toBeGreaterThan(10);
    });

    it('box should wrap content', () => {
      const result = stripAnsi(theme.box('hello', 'Title'));
      expect(result).toContain('hello');
      expect(result).toContain('Title');
    });

    it('record should format DNS record', () => {
      const result = stripAnsi(theme.record('MX', '@', 'mail.example.com', 10));
      expect(result).toContain('MX');
      expect(result).toContain('@');
      expect(result).toContain('mail.example.com');
    });

    it('color functions should return strings', () => {
      expect(typeof theme.primary('test')).toBe('string');
      expect(typeof theme.secondary('test')).toBe('string');
      expect(typeof theme.success('test')).toBe('string');
      expect(typeof theme.warning('test')).toBe('string');
      expect(typeof theme.error('test')).toBe('string');
      expect(typeof theme.muted('test')).toBe('string');
      expect(typeof theme.info('test')).toBe('string');
    });
  });
});
