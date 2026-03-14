import inquirer from 'inquirer';
import { theme } from '../utils/theme';

interface HeaderHop {
  from: string;
  by: string;
  timestamp: string;
  delay: string;
  protocol: string;
}

interface AuthResult {
  method: string;
  result: string;
  details: string;
}

export async function headerAnalyzeCommand(): Promise<void> {
  console.log(theme.heading('Email Header Analyzer'));
  console.log(theme.muted('  Paste raw email headers below.\n'));

  const { headers } = await inquirer.prompt([
    {
      type: 'editor',
      name: 'headers',
      message: 'Paste email headers (opens editor):',
    },
  ]);

  if (!headers || !headers.trim()) {
    console.log(theme.muted('\n  No headers provided.\n'));
    return;
  }

  analyzeHeaders(headers);
}

export function analyzeHeaders(raw: string): void {
  const lines = unfoldHeaders(raw);

  // Parse routing (Received headers)
  const hops = parseReceivedHeaders(lines);
  if (hops.length > 0) {
    console.log(theme.heading('Message Route'));
    for (let i = 0; i < hops.length; i++) {
      const hop = hops[i];
      const num = `${i + 1}.`.padEnd(4);
      console.log(`  ${theme.secondary(num)} ${theme.bold(hop.by)}`);
      if (hop.from) console.log(theme.muted(`       from: ${hop.from}`));
      if (hop.protocol) console.log(theme.muted(`       via: ${hop.protocol}`));
      if (hop.timestamp) console.log(theme.muted(`       at: ${hop.timestamp}`));
      if (hop.delay && hop.delay !== '0s') console.log(theme.warning(`       delay: ${hop.delay}`));
    }
    console.log('');
  }

  // Parse authentication results
  const authResults = parseAuthResults(lines);
  if (authResults.length > 0) {
    console.log(theme.heading('Authentication Results'));
    for (const auth of authResults) {
      const icon =
        auth.result === 'pass'
          ? theme.statusIcon('pass')
          : auth.result === 'fail'
            ? theme.statusIcon('fail')
            : theme.statusIcon('warn');
      const color = auth.result === 'pass' ? theme.success : auth.result === 'fail' ? theme.error : theme.warning;
      console.log(
        `  ${icon} ${theme.bold(auth.method.toUpperCase().padEnd(10))} ${color(auth.result)}  ${theme.muted(auth.details)}`,
      );
    }
    console.log('');
  }

  // Parse key headers
  console.log(theme.heading('Message Details'));
  const keyHeaders = ['from', 'to', 'subject', 'date', 'message-id', 'return-path', 'reply-to'];
  for (const key of keyHeaders) {
    const value = findHeader(lines, key);
    if (value) {
      console.log(theme.keyValue(key.charAt(0).toUpperCase() + key.slice(1), value));
    }
  }

  // Spam headers
  const spamScore = findHeader(lines, 'x-spam-score') || findHeader(lines, 'x-spam-status');
  if (spamScore) {
    console.log('');
    console.log(theme.heading('Spam Analysis'));
    console.log(theme.keyValue('Spam Score', spamScore));
    const spamFlag = findHeader(lines, 'x-spam-flag');
    if (spamFlag) console.log(theme.keyValue('Spam Flag', spamFlag));
  }

  // Total transit time
  if (hops.length >= 2) {
    console.log('');
    const firstTime = parseDate(hops[0].timestamp);
    const lastTime = parseDate(hops[hops.length - 1].timestamp);
    if (firstTime && lastTime) {
      const totalMs = Math.abs(lastTime.getTime() - firstTime.getTime());
      const totalSec = Math.round(totalMs / 1000);
      console.log(theme.keyValue('Total Transit', `${totalSec}s (${hops.length} hops)`));
    }
  }
  console.log('');
}

function unfoldHeaders(raw: string): string[] {
  // Unfold continuation lines (lines starting with whitespace)
  const unfolded = raw.replace(/\r\n/g, '\n').replace(/\n[ \t]+/g, ' ');
  return unfolded.split('\n').filter((l) => l.trim());
}

function findHeader(lines: string[], name: string): string | null {
  const prefix = name.toLowerCase() + ':';
  for (const line of lines) {
    if (line.toLowerCase().startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
  }
  return null;
}

function parseReceivedHeaders(lines: string[]): HeaderHop[] {
  const hops: HeaderHop[] = [];
  const receivedLines = lines.filter((l) => l.toLowerCase().startsWith('received:'));

  for (const line of receivedLines) {
    const content = line.slice('received:'.length).trim();

    const fromMatch = content.match(/from\s+(\S+)/i);
    const byMatch = content.match(/by\s+(\S+)/i);
    const withMatch = content.match(/with\s+(\S+)/i);
    const dateMatch = content.match(/;\s*(.+)$/);

    hops.push({
      from: fromMatch ? fromMatch[1] : '',
      by: byMatch ? byMatch[1] : 'unknown',
      protocol: withMatch ? withMatch[1] : '',
      timestamp: dateMatch ? dateMatch[1].trim() : '',
      delay: '',
    });
  }

  // Calculate delays between hops
  for (let i = 1; i < hops.length; i++) {
    const prev = parseDate(hops[i - 1].timestamp);
    const curr = parseDate(hops[i].timestamp);
    if (prev && curr) {
      const diffMs = Math.abs(curr.getTime() - prev.getTime());
      const diffSec = Math.round(diffMs / 1000);
      if (diffSec < 60) hops[i].delay = `${diffSec}s`;
      else if (diffSec < 3600) hops[i].delay = `${Math.round(diffSec / 60)}m`;
      else hops[i].delay = `${Math.round(diffSec / 3600)}h`;
    }
  }

  // Reverse so first hop is first
  return hops.reverse();
}

function parseAuthResults(lines: string[]): AuthResult[] {
  const results: AuthResult[] = [];

  for (const line of lines) {
    if (!line.toLowerCase().startsWith('authentication-results:')) continue;
    const content = line.slice('authentication-results:'.length).trim();

    // Parse individual results
    const parts = content.split(';').slice(1); // skip the server identifier
    for (const part of parts) {
      const trimmed = part.trim();
      const match = trimmed.match(/^(\w+)=(\w+)\s*(.*)/);
      if (match) {
        results.push({ method: match[1], result: match[2], details: match[3] || '' });
      }
    }
  }

  // Also check for individual auth headers
  const dkimResult = findHeader(lines, 'dkim-signature');
  if (dkimResult && !results.find((r) => r.method === 'dkim')) {
    results.push({ method: 'dkim', result: 'present', details: 'DKIM-Signature header found' });
  }

  return results;
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
