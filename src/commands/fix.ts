import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { getCreds } from '../utils/shared';
import { listDomains, listEmailAccounts, getCatchAll, setCatchAll, getDkimKey } from '../utils/directadmin';
import { checkSpfRecord, checkDkimRecord, checkDmarcRecord, checkMxRecords } from '../utils/dns';
import { routeDnsAdd, routeDnsDelete } from '../utils/dns-router';
import { generateMxrouteRecords } from '../providers/mxroute-records';

interface FixAction {
  domain: string;
  issue: string;
  fix: string;
  existing?: string;
  proposed?: string;
  destructive?: boolean;
  execute: () => Promise<{ success: boolean; message: string }>;
}

export async function fixCommand(): Promise<void> {
  const config = getConfig();
  const creds = getCreds();

  console.log(theme.heading('Auto-Fix'));
  console.log(theme.muted('  Scanning for issues and preparing fixes...\n'));

  // DNS fixes are routed automatically via dns-router

  // Fetch domains
  const domSpinner = ora({ text: 'Fetching domains...', spinner: 'dots12', color: 'cyan' }).start();
  let domains: string[];
  try {
    domains = await listDomains(creds);
    domSpinner.succeed(`Found ${domains.length} domain${domains.length !== 1 ? 's' : ''}`);
  } catch {
    domSpinner.fail('Could not fetch domains');
    return;
  }

  const actions: FixAction[] = [];

  // Scan each domain
  for (const domain of domains) {
    const scanSpinner = ora({ text: `Scanning ${domain}...`, spinner: 'dots12', color: 'cyan' }).start();

    // Check MX
    const mx = await checkMxRecords(domain, config.server);
    if (mx.status === 'fail') {
      const records = generateMxrouteRecords(config.server, domain);
      const mxRecords = records.filter((r) => r.type === 'MX');
      actions.push({
        domain,
        issue: 'MX records missing or incorrect',
        fix: 'Create MX records via DNS router',
        execute: async () => {
          for (const r of mxRecords) {
            const res = await routeDnsAdd(domain, r);
            if (!res.success) return res;
          }
          return { success: true, message: 'MX records created' };
        },
      });
    }

    // Check SPF
    const spf = await checkSpfRecord(domain);
    if (spf.status === 'fail') {
      actions.push({
        domain,
        issue: 'SPF record missing',
        fix: 'Create SPF TXT record',
        execute: async () =>
          routeDnsAdd(domain, {
            type: 'TXT',
            name: '@',
            value: 'v=spf1 include:mxroute.com -all',
            ttl: 3600,
          }),
      });
    } else if (spf.status === 'warn' && spf.actual && spf.actual.includes('~all')) {
      actions.push({
        domain,
        issue: 'SPF using ~all (soft fail)',
        fix: 'Replace with -all (hard fail)',
        existing: spf.actual,
        proposed: spf.actual.replace('~all', '-all'),
        destructive: true,
        execute: async () => {
          // Delete old, create new
          await routeDnsDelete(domain, { type: 'TXT', name: '@', value: spf.actual });
          return routeDnsAdd(domain, {
            type: 'TXT',
            name: '@',
            value: spf.actual.replace('~all', '-all'),
            ttl: 3600,
          });
        },
      });
    }

    // Check DKIM
    const dkim = await checkDkimRecord(domain);
    if (dkim.status === 'fail') {
      // Try to get DKIM from DirectAdmin
      const dkimKey = await getDkimKey(creds, domain);
      if (dkimKey) {
        actions.push({
          domain,
          issue: 'DKIM record missing in DNS',
          fix: 'Create DKIM TXT record from DirectAdmin key',
          execute: async () =>
            routeDnsAdd(domain, {
              type: 'TXT',
              name: 'x._domainkey',
              value: dkimKey,
              ttl: 3600,
            }),
        });
      }
    }

    // Check DMARC
    const dmarc = await checkDmarcRecord(domain);
    if (dmarc.status === 'fail' || (dmarc.status === 'warn' && dmarc.actual && dmarc.actual.includes('p=none'))) {
      const isNone = dmarc.actual && dmarc.actual.includes('p=none');

      // Determine the rua address — prefer an existing account
      let ruaAddress = `postmaster@${domain}`;
      try {
        const accounts = await listEmailAccounts(creds, domain);
        if (accounts.includes('postmaster')) {
          ruaAddress = `postmaster@${domain}`;
        } else if (accounts.length > 0) {
          ruaAddress = `${accounts[0]}@${domain}`;
        }
      } catch {
        // Fall back to postmaster
      }

      const newDmarcValue = `v=DMARC1; p=quarantine; rua=mailto:${ruaAddress}`;

      actions.push({
        domain,
        issue: isNone ? 'DMARC policy is "none" (no protection)' : 'DMARC record missing',
        fix: isNone
          ? `Replace with p=quarantine (rua=${ruaAddress})`
          : `Create DMARC record with p=quarantine (rua=${ruaAddress})`,
        existing: isNone ? dmarc.actual : undefined,
        proposed: newDmarcValue,
        destructive: !!isNone,
        execute: async () => {
          if (isNone) {
            await routeDnsDelete(domain, {
              type: 'TXT',
              name: '_dmarc',
              value: dmarc.actual,
            });
          }
          return routeDnsAdd(domain, {
            type: 'TXT',
            name: '_dmarc',
            value: newDmarcValue,
            ttl: 3600,
          });
        },
      });
    }

    // Check catch-all
    try {
      const catchAll = await getCatchAll(creds, domain);
      if (catchAll && catchAll !== ':fail:' && catchAll !== ':blackhole:') {
        actions.push({
          domain,
          issue: `Catch-all is open (forwarding to ${catchAll})`,
          fix: 'Set catch-all to reject',
          execute: async () => {
            await setCatchAll(creds, domain, ':fail:');
            return { success: true, message: 'Catch-all set to reject' };
          },
        });
      }
    } catch {
      /* skip */
    }

    scanSpinner.stop();
  }

  // Show results
  if (actions.length === 0) {
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} No issues found — everything looks healthy!\n`));
    return;
  }

  console.log(theme.heading(`Found ${actions.length} fixable issue${actions.length !== 1 ? 's' : ''}`));
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    console.log(`  ${theme.warning(`${i + 1}.`)} ${theme.bold(action.domain)} — ${action.issue}`);
    console.log(theme.muted(`     Fix: ${action.fix}`));
    if (action.existing && action.proposed) {
      console.log(theme.error(`     Current: ${action.existing}`));
      console.log(theme.success(`     New:     ${action.proposed}`));
    }
  }
  console.log('');

  // For destructive actions, ask per action; for safe ones, batch confirm
  const destructiveActions = actions.filter((a) => a.destructive);
  const safeActions = actions.filter((a) => !a.destructive);

  // Confirm safe actions in batch
  if (safeActions.length > 0) {
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: `Apply ${safeActions.length} safe fix${safeActions.length !== 1 ? 'es' : ''} (create missing records)?`,
        default: true,
      },
    ]);
    if (!proceed) {
      // Remove safe actions
      safeActions.length = 0;
    }
  }

  // Confirm destructive actions individually
  const approvedDestructive: FixAction[] = [];
  for (const action of destructiveActions) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `${action.domain}: Replace existing ${action.issue.includes('DMARC') ? 'DMARC' : action.issue.includes('SPF') ? 'SPF' : 'record'}?`,
        default: true,
      },
    ]);
    if (confirm) approvedDestructive.push(action);
  }

  const toExecute = [...safeActions, ...approvedDestructive];
  if (toExecute.length === 0) {
    console.log(theme.muted('\n  No fixes to apply.\n'));
    return;
  }

  // Execute fixes
  console.log(theme.heading('Applying fixes'));
  let fixed = 0;
  let failed = 0;

  for (const action of toExecute) {
    const spinner = ora({ text: `${action.domain}: ${action.fix}...`, spinner: 'dots12', color: 'cyan' }).start();
    try {
      const result = await action.execute();
      if (result.success) {
        spinner.succeed(`${action.domain}: ${action.fix}`);
        fixed++;
      } else {
        spinner.fail(`${action.domain}: ${result.message}`);
        failed++;
      }
    } catch (err: any) {
      spinner.fail(`${action.domain}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(theme.separator());
  if (failed === 0) {
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} All ${fixed} fixes applied successfully!\n`));
  } else {
    console.log(theme.warning(`\n  ${fixed} fixed, ${failed} failed\n`));
  }

  console.log(
    theme.info(
      `  ${theme.statusIcon('info')} Run ${theme.bold('mxroute audit')} to verify, or ${theme.bold('mxroute dns watch')} to monitor propagation.\n`,
    ),
  );
}
