import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { theme } from '../utils/theme';
import { getQuotaUsage, getUserConfig } from '../utils/directadmin';
import { getCreds } from '../utils/shared';
import { getConfigPath } from '../utils/config';
import { isJsonMode, output } from '../utils/json-output';

interface UsageSnapshot {
  timestamp: string;
  disk: number;
  diskLimit: number;
  bandwidth: number;
  bandwidthLimit: number;
  emails: number;
  emailLimit: number;
  domains: number;
}

const HISTORY_FILE = 'usage-history.json';

function getHistoryPath(): string {
  return path.join(path.dirname(getConfigPath()), HISTORY_FILE);
}

function loadHistory(): UsageSnapshot[] {
  try {
    return JSON.parse(fs.readFileSync(getHistoryPath(), 'utf-8'));
  } catch {
    return [];
  }
}

function saveHistory(history: UsageSnapshot[]): void {
  // Keep last 90 entries (daily snapshots for ~3 months)
  const trimmed = history.slice(-90);
  fs.writeFileSync(getHistoryPath(), JSON.stringify(trimmed, null, 2), { mode: 0o600 });
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  return `${mb}MB`;
}

function miniSparkline(values: number[], width: number = 20): string {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const chars = [' ', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];

  // Sample values to fit width
  const sampled: number[] = [];
  for (let i = 0; i < width; i++) {
    const idx = Math.floor((i / width) * values.length);
    sampled.push(values[idx]);
  }

  return sampled
    .map((v) => {
      const idx = Math.min(Math.floor((v / max) * (chars.length - 1)), chars.length - 1);
      return theme.primary(chars[idx]);
    })
    .join('');
}

export async function usageHistoryCommand(): Promise<void> {
  const creds = getCreds();

  if (!isJsonMode()) console.log(theme.heading('Usage History'));

  const spinner = isJsonMode()
    ? null
    : ora({ text: 'Recording current usage...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const [usage, config] = await Promise.all([getQuotaUsage(creds), getUserConfig(creds)]);

    const snapshot: UsageSnapshot = {
      timestamp: new Date().toISOString(),
      disk: Number(usage.quota || usage.disk || 0),
      diskLimit: Number(config.quota || config.disk || 0),
      bandwidth: Number(usage.bandwidth || 0),
      bandwidthLimit: Number(config.bandwidth || 0),
      emails: Number(usage.nemails || usage.email || 0),
      emailLimit: Number(config.nemails || config.email || 0),
      domains: Number(usage.vdomains || usage.ndomains || usage.domains || 0),
    };

    // Add to history
    const history = loadHistory();

    // Don't add duplicate if last entry was within 1 hour
    const lastEntry = history[history.length - 1];
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (!lastEntry || new Date(lastEntry.timestamp).getTime() < oneHourAgo) {
      history.push(snapshot);
      saveHistory(history);
    }

    spinner?.stop();

    if (isJsonMode()) {
      output('snapshot', snapshot);
      output('history', history);
      output('snapshotCount', history.length);
      return;
    }

    if (history.length < 2) {
      console.log(theme.muted('  First snapshot recorded! Run this command periodically to track trends.'));
      console.log(theme.muted(`  Tip: Set up with ${theme.bold('mxroute cron setup')} for automatic tracking.\n`));

      const lines = [
        theme.keyValue(
          'Disk',
          `${formatSize(snapshot.disk)} / ${snapshot.diskLimit > 0 ? formatSize(snapshot.diskLimit) : 'unlimited'}`,
          0,
        ),
        theme.keyValue(
          'Bandwidth',
          `${formatSize(snapshot.bandwidth)} / ${snapshot.bandwidthLimit > 0 ? formatSize(snapshot.bandwidthLimit) : 'unlimited'}`,
          0,
        ),
        theme.keyValue('Email Accounts', snapshot.emails.toString(), 0),
        theme.keyValue('Domains', snapshot.domains.toString(), 0),
        theme.keyValue('Recorded', new Date().toLocaleString(), 0),
      ];
      console.log(theme.box(lines.join('\n'), 'Current Usage'));
      console.log('');
      return;
    }

    // Show trends
    const diskValues = history.map((h) => h.disk);
    const bwValues = history.map((h) => h.bandwidth);
    const emailValues = history.map((h) => h.emails);

    const oldest = history[0];
    const diskDelta = snapshot.disk - oldest.disk;
    const bwDelta = snapshot.bandwidth - oldest.bandwidth;
    const emailDelta = snapshot.emails - oldest.emails;

    function trendArrow(delta: number): string {
      if (delta > 0) return theme.warning('\u2191 +' + delta);
      if (delta < 0) return theme.success('\u2193 ' + delta);
      return theme.muted('\u2192 0');
    }

    const lines = [
      theme.keyValue('Disk', `${formatSize(snapshot.disk)} ${trendArrow(diskDelta)}`, 0),
      theme.keyValue('', `${miniSparkline(diskValues)}`, 0),
      theme.keyValue('Bandwidth', `${formatSize(snapshot.bandwidth)} ${trendArrow(bwDelta)}`, 0),
      theme.keyValue('', `${miniSparkline(bwValues)}`, 0),
      theme.keyValue('Accounts', `${snapshot.emails} ${trendArrow(emailDelta)}`, 0),
      theme.keyValue('', `${miniSparkline(emailValues)}`, 0),
    ];

    console.log(theme.box(lines.join('\n'), 'Usage Trends'));
    console.log('');

    const periodDays = Math.ceil(
      (new Date(snapshot.timestamp).getTime() - new Date(oldest.timestamp).getTime()) / (1000 * 60 * 60 * 24),
    );

    console.log(
      theme.muted(`  Tracking period: ${periodDays} day${periodDays === 1 ? '' : 's'} (${history.length} snapshots)`),
    );
    console.log(theme.muted(`  First recorded: ${new Date(oldest.timestamp).toLocaleDateString()}`));
    console.log(theme.muted(`  Latest: ${new Date(snapshot.timestamp).toLocaleDateString()}\n`));

    // Projections
    if (periodDays > 0 && snapshot.diskLimit > 0 && diskDelta > 0) {
      const dailyRate = diskDelta / periodDays;
      const remaining = snapshot.diskLimit - snapshot.disk;
      const daysUntilFull = Math.floor(remaining / dailyRate);
      if (daysUntilFull < 90) {
        console.log(
          theme.warning(
            `  ${theme.statusIcon('warn')} At current rate, disk quota will be full in ~${daysUntilFull} days.`,
          ),
        );
        console.log('');
      }
    }
  } catch (err: any) {
    spinner?.fail(chalk.red('Failed to record usage'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}
