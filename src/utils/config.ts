import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Profile {
  server: string;
  username: string;
  password: string;
  domain: string;
}

interface MXRouteConfig {
  server: string;
  username: string;
  password: string;
  domain: string;
  profiles: Record<string, Profile>;
  activeProfile: string;
  daUsername: string;
  daLoginKey: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'mxroute-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function readConfig(): MXRouteConfig {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {
      server: '',
      username: '',
      password: '',
      domain: '',
      profiles: {},
      activeProfile: 'default',
      daUsername: '',
      daLoginKey: '',
    };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {
      server: '',
      username: '',
      password: '',
      domain: '',
      profiles: {},
      activeProfile: 'default',
      daUsername: '',
      daLoginKey: '',
    };
  }
}

function writeConfig(config: MXRouteConfig): void {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function getConfig(): MXRouteConfig {
  return readConfig();
}

export function setConfig(key: string, value: any): void {
  const config = readConfig();
  (config as any)[key] = value;
  writeConfig(config);
}

export function setProfile(name: string, profile: Profile): void {
  const config = readConfig();
  config.profiles[name] = profile;
  config.activeProfile = name;
  config.server = profile.server;
  config.username = profile.username;
  config.password = profile.password;
  config.domain = profile.domain;
  writeConfig(config);
}

export function switchProfile(name: string): boolean {
  const config = readConfig();
  if (!config.profiles[name]) return false;
  const profile = config.profiles[name];
  config.activeProfile = name;
  config.server = profile.server;
  config.username = profile.username;
  config.password = profile.password;
  config.domain = profile.domain;
  writeConfig(config);
  return true;
}

export function getProfiles(): Record<string, Profile> {
  return readConfig().profiles;
}

export function deleteProfile(name: string): boolean {
  const config = readConfig();
  if (!config.profiles[name]) return false;
  delete config.profiles[name];
  if (config.activeProfile === name) {
    const remaining = Object.keys(config.profiles);
    if (remaining.length > 0) {
      const p = config.profiles[remaining[0]];
      config.activeProfile = remaining[0];
      config.server = p.server;
      config.username = p.username;
      config.password = p.password;
      config.domain = p.domain;
    } else {
      config.activeProfile = 'default';
      config.server = '';
      config.username = '';
      config.password = '';
      config.domain = '';
    }
  }
  writeConfig(config);
  return true;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
