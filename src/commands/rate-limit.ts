import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';

const RATE_LIMIT = 400; // emails per hour
const RATE_FILE = '.mxroute-send-log.json';

interface SendLog {
  sends: number[];
}

function getRateFilePath(): string {
  const configDir = path.dirname(require('../utils/config').getConfigPath());
  return path.join(configDir, RATE_FILE);
}

function loadSendLog(): SendLog {
  try {
    const data = fs.readFileSync(getRateFilePath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { sends: [] };
  }
}

function pruneOldEntries(log: SendLog): SendLog {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  log.sends = log.sends.filter((t) => t > oneHourAgo);
  return log;
}

export function recordSend(): void {
  const log = pruneOldEntries(loadSendLog());
  log.sends.push(Date.now());
  try {
    fs.writeFileSync(getRateFilePath(), JSON.stringify(log), { mode: 0o600 });
  } catch {
    // Silently fail — rate tracking is best-effort
  }
}

export async function rateLimitCommand(): Promise<void> {
  const config = getConfig();

  console.log(theme.heading('SMTP API Rate Limit Status'));

  const log = pruneOldEntries(loadSendLog());
  const sentThisHour = log.sends.length;
  const remaining = Math.max(0, RATE_LIMIT - sentThisHour);
  const usagePercent = Math.round((sentThisHour / RATE_LIMIT) * 100);

  // Build usage bar
  const barWidth = 30;
  const filled = Math.round((sentThisHour / RATE_LIMIT) * barWidth);
  const empty = barWidth - filled;

  let barColor = theme.success;
  if (usagePercent >= 90) barColor = theme.error;
  else if (usagePercent >= 70) barColor = theme.warning;

  const bar = barColor('='.repeat(filled)) + chalk.hex('#7C8DB0')('-'.repeat(empty));

  const lines = [
    theme.keyValue('Server', config.server ? `${config.server}.mxrouting.net` : 'Not configured', 0),
    theme.keyValue('Rate Limit', `${RATE_LIMIT} emails/hour`, 0),
    theme.keyValue('Sent (this hour)', sentThisHour.toString(), 0),
    theme.keyValue('Remaining', remaining.toString(), 0),
    theme.keyValue('Usage', `[${bar}] ${usagePercent}%`, 0),
  ];

  if (sentThisHour > 0) {
    const oldest = Math.min(...log.sends);
    const resetTime = new Date(oldest + 60 * 60 * 1000);
    lines.push(theme.keyValue('Next Reset', resetTime.toLocaleTimeString(), 0));
  }

  console.log(theme.box(lines.join('\n'), 'Rate Usage'));
  console.log('');

  if (usagePercent >= 90) {
    console.log(theme.warning(`  ${theme.statusIcon('warn')} Approaching rate limit! Slow down to avoid bounces.`));
  } else if (usagePercent >= 70) {
    console.log(theme.warning(`  ${theme.statusIcon('warn')} Usage above 70%. Monitor your sending rate.`));
  } else {
    console.log(theme.success(`  ${theme.statusIcon('pass')} Rate usage is healthy.`));
  }

  console.log('');
  console.log(theme.muted('  Note: This tracks sends via the CLI only. Sends from other'));
  console.log(theme.muted('  clients (webmail, Thunderbird, etc.) are not counted here.'));
  console.log(theme.muted(`  MXroute enforces a hard limit of ${RATE_LIMIT} emails/hour per account.\n`));
}
