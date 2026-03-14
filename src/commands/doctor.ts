// chalk used via theme
import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { runFullDnsCheck } from '../utils/dns';
import { testAuth, listDomains, getQuotaUsage } from '../utils/directadmin';

export async function doctorCommand(): Promise<void> {
  const config = getConfig();

  console.log(theme.heading('MXroute Doctor'));
  console.log(theme.muted('  Running comprehensive health check...\n'));

  let issues = 0;

  // 1. Config check
  console.log(theme.subheading('Configuration'));
  if (config.server) {
    console.log(`    ${theme.statusIcon('pass')} Server: ${config.server}.mxrouting.net`);
  } else {
    console.log(`    ${theme.statusIcon('fail')} Server not configured`);
    issues++;
  }

  // 2. DirectAdmin API
  console.log('');
  console.log(theme.subheading('DirectAdmin API'));
  if (config.daUsername && config.daLoginKey) {
    const spinner = ora({ text: 'Testing API...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const result = await testAuth({
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      });
      spinner.stop();
      if (result.success) {
        console.log(`    ${theme.statusIcon('pass')} Authenticated as ${config.daUsername}`);
      } else {
        console.log(`    ${theme.statusIcon('fail')} Auth failed: ${result.message}`);
        issues++;
      }
    } catch (err: any) {
      spinner.stop();
      console.log(`    ${theme.statusIcon('fail')} Connection error: ${err.message}`);
      issues++;
    }
  } else {
    console.log(`    ${theme.statusIcon('warn')} Not configured — run ${theme.bold('mxroute config setup')}`);
    issues++;
  }

  // 3. SMTP API
  console.log('');
  console.log(theme.subheading('SMTP API'));
  if (config.username && config.password && config.server) {
    console.log(`    ${theme.statusIcon('pass')} Configured: ${config.username}`);
  } else {
    console.log(`    ${theme.statusIcon('info')} Not configured (optional — ${theme.bold('mxroute config smtp')})`);
  }

  // 4. DNS for all domains
  if (config.daUsername && config.daLoginKey && config.server) {
    console.log('');
    console.log(theme.subheading('DNS Health (all domains)'));
    const domSpinner = ora({ text: 'Fetching domains...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const domains = await listDomains({
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      });
      domSpinner.stop();

      for (const domain of domains) {
        const dnsSpinner = ora({ text: `Checking ${domain}...`, spinner: 'dots12', color: 'cyan' }).start();
        try {
          const results = await runFullDnsCheck(domain, config.server);
          dnsSpinner.stop();
          const passed = results.filter((r) => r.status === 'pass').length;
          const failed = results.filter((r) => r.status === 'fail').length;
          const total = results.length;

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
        } catch {
          dnsSpinner.stop();
          console.log(`    ${theme.statusIcon('fail')} ${domain} — DNS check failed`);
          issues++;
        }
      }
    } catch {
      domSpinner.stop();
      console.log(`    ${theme.statusIcon('fail')} Could not fetch domains`);
      issues++;
    }
  }

  // 5. Quota check
  if (config.daUsername && config.daLoginKey) {
    console.log('');
    console.log(theme.subheading('Quota'));
    try {
      const usage = await getQuotaUsage({
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      });
      const diskUsed = Number(usage.quota || usage.disk || 0);
      if (diskUsed > 0) {
        console.log(`    ${theme.statusIcon('pass')} Disk used: ${diskUsed} MB`);
      }
    } catch {
      console.log(`    ${theme.statusIcon('warn')} Could not fetch quota`);
    }
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
}
