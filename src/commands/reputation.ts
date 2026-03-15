import chalk from 'chalk';
import ora from 'ora';
import * as dns from 'dns';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { getCreds, pickDomain } from '../utils/shared';
import { isJsonMode, output } from '../utils/json-output';

function resolveTxt(domain: string): Promise<string[][]> {
  return new Promise((resolve) => {
    dns.resolveTxt(domain, (err, records) => {
      resolve(err ? [] : records || []);
    });
  });
}

function resolveA(domain: string): Promise<string[]> {
  return new Promise((resolve) => {
    dns.resolve4(domain, (err, addresses) => {
      resolve(err ? [] : addresses || []);
    });
  });
}

function resolveMx(domain: string): Promise<dns.MxRecord[]> {
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      resolve(err ? [] : addresses || []);
    });
  });
}

interface ReputationCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
  score: number; // 0-100 contribution
}

export async function reputationCommand(domain?: string): Promise<void> {
  const creds = getCreds();
  const config = getConfig();
  const targetDomain = await pickDomain(creds, domain);

  if (!isJsonMode()) console.log(theme.heading(`Sender Reputation: ${targetDomain}`));

  const spinner = isJsonMode()
    ? null
    : ora({ text: 'Analyzing sender reputation...', spinner: 'dots12', color: 'cyan' }).start();

  const checks: ReputationCheck[] = [];

  try {
    // 1. SPF Check
    if (spinner) spinner.text = 'Checking SPF record...';
    const txtRecords = await resolveTxt(targetDomain);
    const spfRecord = txtRecords.flat().find((r) => r.startsWith('v=spf1'));
    if (spfRecord) {
      const hasHardFail = spfRecord.includes('-all');
      checks.push({
        name: 'SPF Record',
        status: hasHardFail ? 'pass' : 'warn',
        detail: hasHardFail ? `Found with -all (strict): ${spfRecord}` : `Found but uses ~all (soft): ${spfRecord}`,
        score: hasHardFail ? 20 : 10,
      });
    } else {
      checks.push({ name: 'SPF Record', status: 'fail', detail: 'No SPF record found', score: 0 });
    }

    // 2. DKIM Check
    if (spinner) spinner.text = 'Checking DKIM...';
    const dkimSelectors = ['x', 'default', 'google', 'selector1', 'selector2'];
    let dkimFound = false;
    for (const selector of dkimSelectors) {
      const dkimRecords = await resolveTxt(`${selector}._domainkey.${targetDomain}`);
      if (dkimRecords.length > 0 && dkimRecords.flat().some((r) => r.includes('DKIM1'))) {
        dkimFound = true;
        checks.push({
          name: 'DKIM',
          status: 'pass',
          detail: `Found DKIM key (selector: ${selector})`,
          score: 20,
        });
        break;
      }
    }
    if (!dkimFound) {
      checks.push({
        name: 'DKIM',
        status: 'warn',
        detail: 'No DKIM record found (checked common selectors)',
        score: 0,
      });
    }

    // 3. DMARC Check
    if (spinner) spinner.text = 'Checking DMARC...';
    const dmarcRecords = await resolveTxt(`_dmarc.${targetDomain}`);
    const dmarcRecord = dmarcRecords.flat().find((r) => r.startsWith('v=DMARC1'));
    if (dmarcRecord) {
      const hasReject = dmarcRecord.includes('p=reject');
      const hasQuarantine = dmarcRecord.includes('p=quarantine');
      checks.push({
        name: 'DMARC',
        status: hasReject ? 'pass' : hasQuarantine ? 'pass' : 'warn',
        detail: hasReject
          ? 'Policy: reject (strongest)'
          : hasQuarantine
            ? 'Policy: quarantine (good)'
            : 'Policy: none (monitoring only)',
        score: hasReject ? 20 : hasQuarantine ? 15 : 5,
      });
    } else {
      checks.push({ name: 'DMARC', status: 'fail', detail: 'No DMARC record found', score: 0 });
    }

    // 4. MX Records Check
    if (spinner) spinner.text = 'Checking MX records...';
    const mxRecords = await resolveMx(targetDomain);
    if (mxRecords.length > 0) {
      const mxHosts = mxRecords.map((r) => r.exchange).join(', ');
      checks.push({
        name: 'MX Records',
        status: 'pass',
        detail: `${mxRecords.length} MX record${mxRecords.length === 1 ? '' : 's'}: ${mxHosts}`,
        score: 15,
      });
    } else {
      checks.push({ name: 'MX Records', status: 'fail', detail: 'No MX records found', score: 0 });
    }

    // 5. Reverse DNS / PTR (check server IP)
    if (spinner) spinner.text = 'Checking server IP...';
    const serverHost = config.server ? `${config.server}.mxrouting.net` : null;
    if (serverHost) {
      const serverIps = await resolveA(serverHost);
      if (serverIps.length > 0) {
        checks.push({
          name: 'Server IP',
          status: 'pass',
          detail: `${serverHost} resolves to ${serverIps[0]}`,
          score: 10,
        });
      } else {
        checks.push({ name: 'Server IP', status: 'warn', detail: 'Could not resolve server hostname', score: 5 });
      }
    } else {
      checks.push({ name: 'Server IP', status: 'warn', detail: 'Server not configured', score: 0 });
    }

    // 6. Check for common blacklists via DNS
    if (spinner) spinner.text = 'Checking blacklists...';
    if (serverHost) {
      const ips = await resolveA(serverHost);
      if (ips.length > 0) {
        const ip = ips[0];
        const reversed = ip.split('.').reverse().join('.');
        const blacklists = ['zen.spamhaus.org', 'bl.spamcop.net', 'b.barracudacentral.org'];
        let listed = false;

        for (const bl of blacklists) {
          try {
            const results = await resolveA(`${reversed}.${bl}`);
            if (results.length > 0) {
              listed = true;
              checks.push({
                name: 'Blacklist',
                status: 'fail',
                detail: `Listed on ${bl}`,
                score: 0,
              });
            }
          } catch {
            // Not listed — good
          }
        }

        if (!listed) {
          checks.push({
            name: 'Blacklist',
            status: 'pass',
            detail: 'Not listed on major blacklists',
            score: 15,
          });
        }
      }
    }

    spinner?.stop();

    // Calculate overall score
    const maxScore = 100;
    const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
    const scorePercent = Math.min(Math.round((totalScore / maxScore) * 100), 100);

    if (isJsonMode()) {
      output('domain', targetDomain);
      output('score', scorePercent);
      output('checks', checks);
      return;
    }

    // Display results
    for (const check of checks) {
      const icon = theme.statusIcon(check.status);
      console.log(`  ${icon} ${theme.bold(check.name)}`);
      console.log(theme.muted(`      ${check.detail}`));
    }
    console.log('');

    let rating: string;
    let ratingColor: (s: string) => string;
    if (scorePercent >= 90) {
      rating = 'Excellent';
      ratingColor = theme.success;
    } else if (scorePercent >= 70) {
      rating = 'Good';
      ratingColor = theme.success;
    } else if (scorePercent >= 50) {
      rating = 'Fair';
      ratingColor = theme.warning;
    } else {
      rating = 'Poor';
      ratingColor = theme.error;
    }

    const barWidth = 20;
    const filled = Math.round((scorePercent / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = ratingColor('='.repeat(filled)) + chalk.hex('#7C8DB0')('-'.repeat(empty));

    const summaryLines = [
      theme.keyValue('Score', `[${bar}] ${scorePercent}/100`, 0),
      theme.keyValue('Rating', ratingColor(rating), 0),
      theme.keyValue('Checks Passed', `${checks.filter((c) => c.status === 'pass').length}/${checks.length}`, 0),
    ];

    console.log(theme.box(summaryLines.join('\n'), 'Reputation Score'));
    console.log('');

    if (scorePercent < 70) {
      console.log(theme.muted('  Improve your score:'));
      if (!spfRecord) console.log(theme.muted(`    - Add an SPF record: ${theme.bold('mxroute dns generate')}`));
      if (!dkimFound) console.log(theme.muted(`    - Configure DKIM: ${theme.bold('mxroute dnsrecords dkim')}`));
      if (!dmarcRecord) console.log(theme.muted('    - Add a DMARC record'));
      console.log('');
    }
  } catch (err: any) {
    spinner?.fail(chalk.red('Reputation check failed'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}
