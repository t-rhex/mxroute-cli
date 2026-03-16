// chalk used via theme
import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { runFullDnsCheck } from '../utils/dns';
import { testAuth, listDomains, getQuotaUsage } from '../utils/directadmin';
import { isJsonMode, output } from '../utils/json-output';

export async function doctorCommand(): Promise<void> {
  const config = getConfig();

  if (!isJsonMode()) {
    console.log(theme.heading('MXroute Doctor'));
    console.log(theme.muted('  Running comprehensive health check...\n'));
  }

  let issues = 0;

  // Collect results for JSON mode
  const jsonChecks: Array<{ category: string; check: string; status: string; message: string }> = [];

  // 1. Config check
  if (!isJsonMode()) console.log(theme.subheading('Configuration'));
  if (config.server) {
    if (!isJsonMode()) console.log(`    ${theme.statusIcon('pass')} Server: ${config.server}.mxrouting.net`);
    jsonChecks.push({ category: 'config', check: 'server', status: 'pass', message: `${config.server}.mxrouting.net` });
  } else {
    if (!isJsonMode()) console.log(`    ${theme.statusIcon('fail')} Server not configured`);
    jsonChecks.push({ category: 'config', check: 'server', status: 'fail', message: 'Not configured' });
    issues++;
  }

  // 2. DirectAdmin API
  if (!isJsonMode()) {
    console.log('');
    console.log(theme.subheading('DirectAdmin API'));
  }
  if (config.daUsername && config.daLoginKey) {
    const spinner = isJsonMode() ? null : ora({ text: 'Testing API...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const result = await testAuth({
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      });
      spinner?.stop();
      if (result.success) {
        if (!isJsonMode()) console.log(`    ${theme.statusIcon('pass')} Authenticated as ${config.daUsername}`);
        jsonChecks.push({
          category: 'api',
          check: 'directadmin_auth',
          status: 'pass',
          message: `Authenticated as ${config.daUsername}`,
        });
      } else {
        if (!isJsonMode()) console.log(`    ${theme.statusIcon('fail')} Auth failed: ${result.message}`);
        jsonChecks.push({
          category: 'api',
          check: 'directadmin_auth',
          status: 'fail',
          message: result.message || 'Auth failed',
        });
        issues++;
      }
    } catch (err: any) {
      spinner?.stop();
      if (!isJsonMode()) console.log(`    ${theme.statusIcon('fail')} Connection error: ${err.message}`);
      jsonChecks.push({ category: 'api', check: 'directadmin_auth', status: 'fail', message: err.message });
      issues++;
    }
  } else {
    if (!isJsonMode())
      console.log(`    ${theme.statusIcon('warn')} Not configured — run ${theme.bold('mxroute config setup')}`);
    jsonChecks.push({ category: 'api', check: 'directadmin_auth', status: 'warn', message: 'Not configured' });
    issues++;
  }

  // 3. Sending Account
  if (!isJsonMode()) {
    console.log('');
    console.log(theme.subheading('Sending Account'));
  }
  if (config.username && config.password && config.server) {
    if (!isJsonMode()) console.log(`    ${theme.statusIcon('pass')} Configured: ${config.username}`);
    jsonChecks.push({
      category: 'smtp',
      check: 'smtp_config',
      status: 'pass',
      message: `Configured as ${config.username}`,
    });
  } else {
    if (!isJsonMode())
      console.log(
        `    ${theme.statusIcon('info')} Not configured (optional — ${theme.bold('mxroute send to set up')})`,
      );
    jsonChecks.push({ category: 'smtp', check: 'smtp_config', status: 'info', message: 'Not configured (optional)' });
  }

  // 4. DNS for all domains
  const dnsResults: Array<{ domain: string; passed: number; failed: number; total: number; checks: any[] }> = [];
  if (config.daUsername && config.daLoginKey && config.server) {
    if (!isJsonMode()) {
      console.log('');
      console.log(theme.subheading('DNS Health (all domains)'));
    }
    const domSpinner = isJsonMode()
      ? null
      : ora({ text: 'Fetching domains...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const domains = await listDomains({
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      });
      domSpinner?.stop();

      for (const domain of domains) {
        const dnsSpinner = isJsonMode()
          ? null
          : ora({ text: `Checking ${domain}...`, spinner: 'dots12', color: 'cyan' }).start();
        try {
          const results = await runFullDnsCheck(domain, config.server);
          dnsSpinner?.stop();
          const passed = results.filter((r) => r.status === 'pass').length;
          const failed = results.filter((r) => r.status === 'fail').length;
          const total = results.length;

          dnsResults.push({ domain, passed, failed, total, checks: results });

          if (!isJsonMode()) {
            if (failed === 0) {
              console.log(`    ${theme.statusIcon('pass')} ${domain} — ${passed}/${total} checks passed`);
            } else {
              console.log(`    ${theme.statusIcon('fail')} ${domain} — ${passed}/${total} passed, ${failed} failed`);
              for (const r of results.filter((r) => r.status === 'fail')) {
                console.log(`      ${theme.statusIcon('fail')} ${r.type}: ${r.message}`);
              }
              issues += failed;
            }
            const warned = results.filter((r) => r.status === 'warn');
            for (const r of warned) {
              console.log(`      ${theme.statusIcon('warn')} ${r.type}: ${r.message}`);
            }
          } else {
            issues += failed;
          }
        } catch {
          dnsSpinner?.stop();
          if (!isJsonMode()) console.log(`    ${theme.statusIcon('fail')} ${domain} — DNS check failed`);
          dnsResults.push({ domain, passed: 0, failed: 1, total: 1, checks: [] });
          issues++;
        }
      }
    } catch {
      domSpinner?.stop();
      if (!isJsonMode()) console.log(`    ${theme.statusIcon('fail')} Could not fetch domains`);
      issues++;
    }
  }

  // 5. Quota check
  let diskUsed = 0;
  if (config.daUsername && config.daLoginKey) {
    if (!isJsonMode()) {
      console.log('');
      console.log(theme.subheading('Quota'));
    }
    try {
      const usage = await getQuotaUsage({
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      });
      diskUsed = Number(usage.quota || usage.disk || 0);
      if (!isJsonMode() && diskUsed > 0) {
        console.log(`    ${theme.statusIcon('pass')} Disk used: ${diskUsed} MB`);
      }
      jsonChecks.push({ category: 'quota', check: 'disk_usage', status: 'pass', message: `${diskUsed} MB used` });
    } catch {
      if (!isJsonMode()) console.log(`    ${theme.statusIcon('warn')} Could not fetch quota`);
      jsonChecks.push({ category: 'quota', check: 'disk_usage', status: 'warn', message: 'Could not fetch quota' });
    }
  }

  if (isJsonMode()) {
    output('issues', issues);
    output('checks', jsonChecks);
    output('dns', dnsResults);
    output('diskUsed', diskUsed);
    return;
  }

  // Summary
  console.log('');
  console.log(theme.separator());
  if (issues === 0) {
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} All checks passed! Everything looks healthy.\n`));
  } else {
    console.log(
      theme.warning(
        `\n  ${theme.statusIcon('warn')} ${issues} issue${issues !== 1 ? 's' : ''} found. See above for details.\n`,
      ),
    );
  }

  console.log(theme.subheading('Specialized checks'));
  console.log(theme.muted('    mxroute dns check <domain>    DNS records for one domain'));
  console.log(theme.muted('    mxroute audit                 Security score'));
  console.log(theme.muted('    mxroute reputation <domain>   Deliverability check'));
  console.log(theme.muted('    mxroute ip                    IP blacklist check'));
  console.log('');
}
