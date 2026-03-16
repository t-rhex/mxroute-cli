import { theme } from '../utils/theme';
import { getActivityLog, getActivityLogPath } from '../utils/activity-log';

export function logCommand(options?: { count?: string }): void {
  const count = Number(options?.count) || 20;
  const entries = getActivityLog(count);

  console.log(theme.heading('Activity Log'));

  if (entries.length === 0) {
    console.log(theme.muted('  No activity recorded yet.\n'));
    return;
  }

  for (const entry of entries) {
    const time = new Date(entry.timestamp);
    const timeStr = `${time.toLocaleDateString()} ${time.toLocaleTimeString()}`;
    const icon = entry.result === 'success' ? theme.statusIcon('pass') : theme.statusIcon('fail');
    const domain = entry.domain ? theme.muted(` [${entry.domain}]`) : '';

    console.log(`  ${icon} ${theme.muted(timeStr)}  ${theme.bold(entry.action)}${domain}`);
    console.log(theme.muted(`     ${entry.details}`));
  }

  console.log('');
  console.log(theme.muted(`  ${entries.length} entries shown (${getActivityLogPath()})\n`));
}
