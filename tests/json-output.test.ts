import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setJsonMode, isJsonMode, output, outputError, flush, resetBuffer } from '../dist/utils/json-output';

describe('json-output module', () => {
  beforeEach(() => {
    resetBuffer();
  });

  it('isJsonMode() defaults to false', () => {
    expect(isJsonMode()).toBe(false);
  });

  it('setJsonMode(true) enables JSON mode', () => {
    setJsonMode(true);
    expect(isJsonMode()).toBe(true);
  });

  it('output() only buffers when JSON mode is on', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // JSON mode is off (after resetBuffer)
    output('key', 'value');
    flush();
    expect(writeSpy).not.toHaveBeenCalled();

    // Turn on JSON mode
    setJsonMode(true);
    output('key', 'value');
    flush();
    expect(writeSpy).toHaveBeenCalledOnce();

    writeSpy.mockRestore();
    resetBuffer();
  });

  it('outputError() sets the error envelope correctly', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    outputError('AUTH_FAILED', 'Authentication failed');
    flush();

    expect(writeSpy).toHaveBeenCalledOnce();
    const written = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed).toEqual({
      success: false,
      error: 'AUTH_FAILED',
      message: 'Authentication failed',
    });

    writeSpy.mockRestore();
    resetBuffer();
  });

  it('flush() is a no-op when buffer is empty and no error', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    setJsonMode(true);
    flush();

    expect(writeSpy).not.toHaveBeenCalled();

    writeSpy.mockRestore();
    resetBuffer();
  });

  it('resetBuffer() clears state', () => {
    setJsonMode(true);
    output('foo', 'bar');
    outputError('ERR', 'msg');

    resetBuffer();

    expect(isJsonMode()).toBe(false);

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    flush();
    expect(writeSpy).not.toHaveBeenCalled();

    writeSpy.mockRestore();
  });

  it('flush() wraps data in success envelope', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    setJsonMode(true);
    output('domains', ['example.com']);
    output('count', 1);
    flush();

    expect(writeSpy).toHaveBeenCalledOnce();
    const written = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed).toEqual({
      success: true,
      data: {
        domains: ['example.com'],
        count: 1,
      },
    });

    writeSpy.mockRestore();
    resetBuffer();
  });

  it('flush() does NOT wrap error data (already has success: false)', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    setJsonMode(true);
    output('someKey', 'someValue');
    outputError('NOT_FOUND', 'Resource not found');
    flush();

    expect(writeSpy).toHaveBeenCalledOnce();
    const written = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('NOT_FOUND');
    expect(parsed.message).toBe('Resource not found');
    // Should NOT have a data wrapper
    expect(parsed.data).toBeUndefined();

    writeSpy.mockRestore();
    resetBuffer();
  });
});
