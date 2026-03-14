import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { getCreds } from '../utils/shared';
import {
  listDomains,
  listEmailAccounts,
  listForwarders,
  getForwarderDestination,
  getCatchAll,
} from '../utils/directadmin';
import { checkSpfRecord, checkDkimRecord, checkDmarcRecord, checkMxRecords } from '../utils/dns';

interface AuditResult {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warn' | 'info';
  message: string;
  domain?: string;
}

export async function auditCommand(): Promise<void> {
  const config = getConfig();
  const creds = getCreds();

  console.log(theme.heading('Security Audit'));
  console.log(theme.muted('  Scanning all domains for security issues...\n'));

  const results: AuditResult[] = [];
  let score = 100;

  // Fetch all domains
  const domSpinner = ora({ text: 'Fetching domains...', spinner: 'dots12', color: 'cyan' }).start();
  let domains: string[];
  try {
    domains = await listDomains(creds);
    domSpinner.succeed(`Found ${domains.length} domain${domains.length !== 1 ? 's' : ''}`);
  } catch (err: any) {
    domSpinner.fail('Could not fetch domains');
    console.log(theme.error(`  ${err.message}\n`));
    return;
  }

  // Per-domain checks
  for (const domain of domains) {
    const spinner = ora({ text: `Auditing ${domain}...`, spinner: 'dots12', color: 'cyan' }).start();

    // 1. MX Records
    const mx = await checkMxRecords(domain, config.server);
    if (mx.status === 'fail') {
      results.push({ category: 'DNS', check: 'MX Records', status: 'fail', message: mx.message, domain });
      score -= 15;
    } else if (mx.status === 'warn') {
      results.push({ category: 'DNS', check: 'MX Records', status: 'warn', message: mx.message, domain });
      score -= 5;
    } else {
      results.push({ category: 'DNS', check: 'MX Records', status: 'pass', message: 'Correctly configured', domain });
    }

    // 2. SPF Record
    const spf = await checkSpfRecord(domain);
    if (spf.status === 'fail') {
      results.push({ category: 'DNS', check: 'SPF Record', status: 'fail', message: spf.message, domain });
      score -= 15;
    } else if (spf.status === 'warn') {
      results.push({
        category: 'DNS',
        check: 'SPF (soft fail)',
        status: 'warn',
        message: 'Using ~all instead of -all — recommend hard fail',
        domain,
      });
      score -= 5;
    } else {
      results.push({
        category: 'DNS',
        check: 'SPF Record',
        status: 'pass',
        message: 'Correctly configured with hard fail',
        domain,
      });
    }

    // 3. SPF lookup count (check if SPF has too many includes)
    if (spf.actual && spf.actual.includes('include:')) {
      const includeCount = (spf.actual.match(/include:/g) || []).length;
      if (includeCount > 7) {
        results.push({
          category: 'DNS',
          check: 'SPF Lookup Count',
          status: 'warn',
          message: `${includeCount} includes — approaching 10 DNS lookup limit`,
          domain,
        });
        score -= 5;
      } else {
        results.push({
          category: 'DNS',
          check: 'SPF Lookup Count',
          status: 'pass',
          message: `${includeCount} includes — within limits`,
          domain,
        });
      }
    }

    // 4. DKIM Record
    const dkim = await checkDkimRecord(domain);
    if (dkim.status === 'fail') {
      results.push({
        category: 'DNS',
        check: 'DKIM Record',
        status: 'fail',
        message: 'Missing — emails may be rejected',
        domain,
      });
      score -= 15;
    } else {
      results.push({ category: 'DNS', check: 'DKIM Record', status: 'pass', message: 'Present and valid', domain });
    }

    // 5. DMARC Record
    const dmarc = await checkDmarcRecord(domain);
    if (dmarc.status === 'fail' || dmarc.status === 'warn') {
      const isNone = dmarc.actual && dmarc.actual.includes('p=none');
      if (isNone) {
        results.push({
          category: 'DNS',
          check: 'DMARC Policy',
          status: 'warn',
          message: 'Policy is "none" — no protection against spoofing',
          domain,
        });
        score -= 5;
      } else if (dmarc.status === 'fail') {
        results.push({
          category: 'DNS',
          check: 'DMARC Record',
          status: 'fail',
          message: 'Missing — no spoofing protection',
          domain,
        });
        score -= 10;
      } else {
        results.push({ category: 'DNS', check: 'DMARC Record', status: 'warn', message: dmarc.message, domain });
        score -= 3;
      }
    } else {
      results.push({
        category: 'DNS',
        check: 'DMARC Record',
        status: 'pass',
        message: 'Configured with quarantine or reject',
        domain,
      });
    }

    // 6. Catch-all check
    try {
      const catchAll = await getCatchAll(creds, domain);
      if (catchAll && catchAll !== ':fail:' && catchAll !== ':blackhole:') {
        results.push({
          category: 'Email',
          check: 'Catch-All',
          status: 'warn',
          message: `Enabled — forwarding to ${catchAll}. This attracts spam.`,
          domain,
        });
        score -= 5;
      } else if (catchAll === ':fail:') {
        results.push({
          category: 'Email',
          check: 'Catch-All',
          status: 'pass',
          message: 'Disabled (reject) — good',
          domain,
        });
      } else {
        results.push({ category: 'Email', check: 'Catch-All', status: 'pass', message: 'Disabled', domain });
      }
    } catch {
      results.push({ category: 'Email', check: 'Catch-All', status: 'info', message: 'Could not check', domain });
    }

    // 7. Forwarding loop detection
    try {
      const forwarders = await listForwarders(creds, domain);
      for (const fwd of forwarders) {
        try {
          const dest = await getForwarderDestination(creds, domain, fwd);
          // Check if forwarding to same domain (possible loop)
          if (dest.includes(`@${domain}`)) {
            results.push({
              category: 'Email',
              check: 'Forwarding Loop',
              status: 'warn',
              message: `${fwd}@${domain} forwards to ${dest} (same domain — possible loop)`,
              domain,
            });
            score -= 3;
          }
        } catch {
          // skip
        }
      }
    } catch {
      // skip
    }

    // 8. Account count check
    try {
      const accounts = await listEmailAccounts(creds, domain);
      results.push({
        category: 'Email',
        check: 'Account Count',
        status: 'info',
        message: `${accounts.length} email account${accounts.length !== 1 ? 's' : ''}`,
        domain,
      });
    } catch {
      // skip
    }

    spinner.stop();
  }

  // Display results grouped by domain
  console.log('');
  for (const domain of domains) {
    console.log(theme.heading(`${domain}`));
    const domainResults = results.filter((r) => r.domain === domain);
    for (const r of domainResults) {
      const icon = theme.statusIcon(r.status);
      console.log(`    ${icon} ${theme.bold(r.check.padEnd(22))} ${theme.muted(r.message)}`);
    }
  }

  // Score
  score = Math.max(0, Math.min(100, score));
  console.log(theme.separator());
  console.log('');

  let scoreColor = theme.success;
  let scoreLabel = 'Excellent';
  if (score < 60) {
    scoreColor = theme.error;
    scoreLabel = 'Needs attention';
  } else if (score < 80) {
    scoreColor = theme.warning;
    scoreLabel = 'Fair';
  } else if (score < 95) {
    scoreColor = theme.info;
    scoreLabel = 'Good';
  }

  const bar = buildScoreBar(score);
  console.log(`  ${theme.bold('Security Score:')} ${scoreColor(`${score}/100`)} ${theme.muted(`— ${scoreLabel}`)}`);
  console.log(`  ${bar}`);
  console.log('');

  const fails = results.filter((r) => r.status === 'fail').length;
  const warns = results.filter((r) => r.status === 'warn').length;
  if (fails > 0) {
    console.log(theme.error(`  ${fails} critical issue${fails !== 1 ? 's' : ''} found`));
  }
  if (warns > 0) {
    console.log(theme.warning(`  ${warns} warning${warns !== 1 ? 's' : ''}`));
  }
  if (fails === 0 && warns === 0) {
    console.log(theme.success(`  ${theme.statusIcon('pass')} All checks passed!`));
  }
  console.log('');
}

function buildScoreBar(score: number, width = 30): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const chalk = require('chalk');
  let color = chalk.hex('#00E676');
  if (score < 60) color = chalk.hex('#FF5252');
  else if (score < 80) color = chalk.hex('#FFD600');
  else if (score < 95) color = chalk.hex('#448AFF');

  return `  ${color('█'.repeat(filled))}${chalk.hex('#333')('░'.repeat(empty))} `;
}
