import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LOG_DIR = path.join(os.homedir(), '.config', 'mxroute-cli');
const LOG_FILE = path.join(LOG_DIR, 'activity.log');
const MAX_ENTRIES = 500;

export interface ActivityEntry {
  timestamp: string;
  action: string; // e.g., 'accounts.create', 'dns.add', 'fix.dmarc'
  domain?: string;
  details: string; // human-readable summary
  result: 'success' | 'failed';
}

export function logActivity(entry: Omit<ActivityEntry, 'timestamp'>): void {
  const full: ActivityEntry = { timestamp: new Date().toISOString(), ...entry };

  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

  // Append as newline-delimited JSON
  fs.appendFileSync(LOG_FILE, JSON.stringify(full) + '\n', { mode: 0o600 });

  // Trim if too large (read all, keep last MAX_ENTRIES)
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf-8').trim();
    const lines = content.split('\n');
    if (lines.length > MAX_ENTRIES) {
      const trimmed = lines.slice(-MAX_ENTRIES).join('\n') + '\n';
      fs.writeFileSync(LOG_FILE, trimmed, { mode: 0o600 });
    }
  } catch {
    /* skip trim errors */
  }
}

export function getActivityLog(count = 20): ActivityEntry[] {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf-8').trim();
    if (!content) return [];
    const lines = content.split('\n');
    return lines
      .slice(-count)
      .reverse()
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function getActivityLogPath(): string {
  return LOG_FILE;
}
