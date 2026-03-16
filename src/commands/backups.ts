import { theme } from '../utils/theme';
import { listBackups, getBackupDir } from '../utils/auto-backup';

export function backupsCommand(): void {
  const backups = listBackups();

  console.log(theme.heading('Auto-Backups'));

  if (backups.length === 0) {
    console.log(theme.muted('  No backups recorded yet.'));
    console.log(theme.muted('  Backups are created automatically before destructive operations.\n'));
    return;
  }

  for (const b of backups) {
    const time = new Date(b.timestamp);
    const timeStr = `${time.toLocaleDateString()} ${time.toLocaleTimeString()}`;
    console.log(
      `  ${theme.statusIcon('info')} ${theme.muted(timeStr)}  ${theme.bold(b.action)}  ${theme.muted(`[${b.domain}]`)}`,
    );
    console.log(theme.muted(`     ${JSON.stringify(b.data)}`));
  }

  console.log('');
  console.log(theme.muted(`  ${backups.length} backups stored in ${getBackupDir()}\n`));
}
