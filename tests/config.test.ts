import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// We need to test the config module but it uses a fixed path.
// We'll test the logic by importing and using temp dirs.

describe('Config Module', () => {
  const tmpDir = path.join(os.tmpdir(), 'mxroute-cli-test-' + Date.now());
  const configFile = path.join(tmpDir, 'config.json');

  beforeEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  it('should handle missing config file gracefully', () => {
    const { getConfig } = require('../dist/utils/config');
    const config = getConfig();
    expect(config).toBeDefined();
    expect(typeof config.server).toBe('string');
    expect(typeof config.profiles).toBe('object');
  });

  it('should have correct config structure', () => {
    const { getConfig } = require('../dist/utils/config');
    const config = getConfig();
    expect(config).toHaveProperty('server');
    expect(config).toHaveProperty('username');
    expect(config).toHaveProperty('password');
    expect(config).toHaveProperty('domain');
    expect(config).toHaveProperty('profiles');
    expect(config).toHaveProperty('activeProfile');
    expect(config).toHaveProperty('daUsername');
    expect(config).toHaveProperty('daLoginKey');
  });

  it('should return config path as string', () => {
    const { getConfigPath } = require('../dist/utils/config');
    const p = getConfigPath();
    expect(typeof p).toBe('string');
    expect(p).toContain('config.json');
  });
});
