import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const BACKUP_DIR = path.join(os.homedir(), '.config', 'mxroute-cli', 'backups');
const MAX_BACKUPS = 10;

export interface BackupEntry {
  timestamp: string;
  action: string;
  domain: string;
  type: string; // 'account', 'forwarder', 'catchall', 'dns', 'autoresponder'
  data: any; // the thing being deleted/modified
}

/**
 * Save a snapshot of data before a destructive operation.
 * Call this BEFORE deleting or modifying anything.
 */
export function snapshotBeforeDelete(entry: Omit<BackupEntry, 'timestamp'>): void {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });

  const full: BackupEntry = { timestamp: new Date().toISOString(), ...entry };
  const filename = `${Date.now()}-${entry.type}-${entry.domain}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(full, null, 2), { mode: 0o600 });

  // Trim old backups
  try {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    for (const file of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BACKUP_DIR, file));
    }
  } catch {
    /* skip */
  }
}

/**
 * List recent backups.
 */
export function listBackups(count = 10): BackupEntry[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  try {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, count);
    return files
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), 'utf-8'));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function getBackupDir(): string {
  return BACKUP_DIR;
}
