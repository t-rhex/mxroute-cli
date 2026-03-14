import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { runFullDnsCheck } from '../utils/dns';

export async function dnsWatchCommand(domain?: string): Promise<void> {
  const config = getConfig();
  const targetDomain = domain || config.domain;
  const server = config.server;

  if (!targetDomain || !server) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} Configure domain and server first: ${theme.bold('mxroute config setup')}\n`,
      ),
    );
    process.exit(1);
  }

  console.log(theme.heading(`DNS Watch: ${targetDomain}`));
  console.log(theme.muted('  Checking every 15 seconds until all records resolve. Press Ctrl+C to stop.\n'));

  let checkCount = 0;
  let lastPassed = -1;

  const check = async () => {
    checkCount++;
    const spinner = ora({ text: `Check #${checkCount}...`, spinner: 'dots12', color: 'cyan' }).start();

    try {
      const results = await runFullDnsCheck(targetDomain, server);
      spinner.stop();

      const passed = results.filter((r) => r.status === 'pass').length;
      const total = results.length;
      const failed = results.filter((r) => r.status === 'fail');
      const warned = results.filter((r) => r.status === 'warn');

      const timestamp = new Date().toLocaleTimeString();

      if (passed !== lastPassed) {
        // Status changed — show full details
        console.log(theme.subheading(`${timestamp} — ${passed}/${total} passing`));
        for (const r of results) {
          const icon = theme.statusIcon(r.status);
          console.log(`    ${icon} ${r.type.padEnd(6)} ${theme.muted(r.message)}`);
        }
        console.log('');
        lastPassed = passed;
      } else {
        // No change — compact output
        const failInfo = failed.length > 0 ? theme.error(` (${failed.map((f) => f.type).join(', ')} failing)`) : '';
        const warnInfo = warned.length > 0 ? theme.warning(` (${warned.map((w) => w.type).join(', ')} warning)`) : '';
        console.log(theme.muted(`  ${timestamp}  ${passed}/${total} passing${failInfo}${warnInfo}`));
      }

      if (passed === total) {
        console.log('');
        console.log(
          theme.success(`  ${theme.statusIcon('pass')} All ${total} DNS checks passing! Propagation complete.`),
        );
        console.log('');
        process.exit(0);
      }
    } catch (err: any) {
      spinner.stop();
      console.log(theme.error(`  Check failed: ${err.message}`));
    }
  };

  // Initial check
  await check();

  // Repeat every 15 seconds
  setInterval(check, 15000);
}
