import chalk from 'chalk';
import ora from 'ora';
import * as dns from 'dns';
import { theme } from '../utils/theme';
import {
  listDomains,
  listEmailAccounts,
  listForwarders,
  getForwarderDestination,
  listAutoresponders,
  getCatchAll,
} from '../utils/directadmin';
import { getCreds } from '../utils/shared';

interface CleanupIssue {
  type: 'unused' | 'orphaned' | 'redundant' | 'misconfigured';
  severity: 'low' | 'medium' | 'high';
  domain: string;
  resource: string;
  description: string;
  suggestion: string;
}

function resolveMx(domain: string): Promise<dns.MxRecord[]> {
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      resolve(err ? [] : addresses || []);
    });
  });
}

export async function cleanupCommand(): Promise<void> {
  const creds = getCreds();

  console.log(theme.heading('Account Cleanup Scan'));
  console.log(theme.muted('  Scanning for unused accounts, orphaned forwarders, and redundant configs...\n'));

  const spinner = ora({ text: 'Fetching domains...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const domains = await listDomains(creds);
    const issues: CleanupIssue[] = [];

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      spinner.text = `Scanning ${domain} (${i + 1}/${domains.length})...`;

      let accounts: string[] = [];
      let forwarders: string[] = [];
      let autoresponders: string[] = [];

      try {
        accounts = await listEmailAccounts(creds, domain);
      } catch {
        /* skip */
      }

      try {
        forwarders = await listForwarders(creds, domain);
      } catch {
        /* skip */
      }

      try {
        autoresponders = await listAutoresponders(creds, domain);
      } catch {
        /* skip */
      }

      // Check for forwarders pointing to non-existent local accounts
      for (const fwd of forwarders) {
        try {
          const dest = await getForwarderDestination(creds, domain, fwd);
          const destinations = dest
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean);

          for (const destEmail of destinations) {
            const atIdx = destEmail.lastIndexOf('@');
            if (atIdx === -1) continue;

            const destDomain = destEmail.substring(atIdx + 1);
            const destUser = destEmail.substring(0, atIdx);

            // Check if forwarding to same domain but account doesn't exist
            if (destDomain === domain && !accounts.includes(destUser)) {
              issues.push({
                type: 'orphaned',
                severity: 'medium',
                domain,
                resource: `${fwd}@${domain} \u2192 ${destEmail}`,
                description: 'Forwarder points to non-existent local account',
                suggestion: `Delete with: mxroute forwarders delete ${domain}`,
              });
            }

            // Check if destination domain has MX records
            if (destDomain !== domain) {
              const mx = await resolveMx(destDomain);
              if (mx.length === 0) {
                issues.push({
                  type: 'orphaned',
                  severity: 'high',
                  domain,
                  resource: `${fwd}@${domain} \u2192 ${destEmail}`,
                  description: `Destination domain "${destDomain}" has no MX records`,
                  suggestion: `Delete with: mxroute forwarders delete ${domain}`,
                });
              }
            }
          }
        } catch {
          /* skip */
        }
      }

      // Check for autoresponders on accounts that don't exist
      for (const ar of autoresponders) {
        if (!accounts.includes(ar)) {
          issues.push({
            type: 'orphaned',
            severity: 'low',
            domain,
            resource: `autoresponder: ${ar}@${domain}`,
            description: 'Autoresponder exists for non-existent account',
            suggestion: `Delete with: mxroute autoresponder delete ${domain}`,
          });
        }
      }

      // Check catch-all pointing to non-existent account
      try {
        const catchAll = await getCatchAll(creds, domain);
        if (catchAll && catchAll !== ':fail:' && catchAll !== ':blackhole:') {
          const catchUser = catchAll.split('@')[0];
          if (catchUser && !accounts.includes(catchUser) && !catchAll.includes('@')) {
            // Catch-all user doesn't exist as an account
            if (!accounts.includes(catchAll)) {
              issues.push({
                type: 'misconfigured',
                severity: 'medium',
                domain,
                resource: `catch-all: ${catchAll}`,
                description: 'Catch-all points to non-existent account',
                suggestion: `Update with: mxroute catchall set ${domain}`,
              });
            }
          }
        }
      } catch {
        /* skip */
      }

      // Check for accounts with same name as forwarders (potential conflict)
      for (const fwd of forwarders) {
        if (accounts.includes(fwd)) {
          issues.push({
            type: 'redundant',
            severity: 'low',
            domain,
            resource: `${fwd}@${domain}`,
            description: 'Account and forwarder exist with same name — forwarder may not work',
            suggestion: 'Remove either the account or forwarder to avoid conflicts',
          });
        }
      }
    }

    spinner.stop();

    if (issues.length === 0) {
      console.log(
        theme.success(
          `  ${theme.statusIcon('pass')} No issues found across ${domains.length} domain${domains.length === 1 ? '' : 's'}!`,
        ),
      );
      console.log(theme.muted('  Your account is clean.\n'));
      return;
    }

    // Group by severity
    const high = issues.filter((i) => i.severity === 'high');
    const medium = issues.filter((i) => i.severity === 'medium');
    const low = issues.filter((i) => i.severity === 'low');

    console.log(
      theme.muted(
        `  Found ${issues.length} issue${issues.length === 1 ? '' : 's'} across ${domains.length} domain${domains.length === 1 ? '' : 's'}:\n`,
      ),
    );

    if (high.length > 0) {
      console.log(theme.error('  High Priority:'));
      for (const issue of high) {
        console.log(`    ${theme.statusIcon('fail')} ${theme.bold(issue.resource)}`);
        console.log(theme.muted(`        ${issue.description}`));
        console.log(theme.muted(`        ${issue.suggestion}`));
      }
      console.log('');
    }

    if (medium.length > 0) {
      console.log(theme.warning('  Medium Priority:'));
      for (const issue of medium) {
        console.log(`    ${theme.statusIcon('warn')} ${theme.bold(issue.resource)}`);
        console.log(theme.muted(`        ${issue.description}`));
        console.log(theme.muted(`        ${issue.suggestion}`));
      }
      console.log('');
    }

    if (low.length > 0) {
      console.log(theme.muted('  Low Priority:'));
      for (const issue of low) {
        console.log(`    ${theme.statusIcon('info')} ${theme.bold(issue.resource)}`);
        console.log(theme.muted(`        ${issue.description}`));
        console.log(theme.muted(`        ${issue.suggestion}`));
      }
      console.log('');
    }

    // Summary
    const summaryLines = [
      theme.keyValue('Total Issues', issues.length.toString(), 0),
      theme.keyValue('High', high.length > 0 ? theme.error(high.length.toString()) : '0', 0),
      theme.keyValue('Medium', medium.length > 0 ? theme.warning(medium.length.toString()) : '0', 0),
      theme.keyValue('Low', low.length > 0 ? theme.info(low.length.toString()) : '0', 0),
      theme.keyValue('Domains Scanned', domains.length.toString(), 0),
    ];

    console.log(theme.box(summaryLines.join('\n'), 'Cleanup Summary'));
    console.log('');
  } catch (err: any) {
    spinner.fail(chalk.red('Cleanup scan failed'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}
