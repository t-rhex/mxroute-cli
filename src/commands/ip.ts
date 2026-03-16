import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { resolveServerIp, checkAllBlacklists, getBlacklistCount } from '../utils/blacklist';
import { isJsonMode, output } from '../utils/json-output';

export async function ipCheckCommand(server?: string): Promise<void> {
  const config = getConfig();
  const hostname = server
    ? server.includes('.')
      ? server
      : `${server}.mxrouting.net`
    : config.server
      ? `${config.server}.mxrouting.net`
      : '';

  if (!hostname) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} No server configured. Run ${theme.bold('mxroute config setup')} or specify a server.\n`,
      ),
    );
    return;
  }

  if (!isJsonMode()) console.log(theme.heading('IP Reputation Check'));

  // Resolve IP
  const ipSpinner = isJsonMode()
    ? null
    : ora({ text: `Resolving ${hostname}...`, spinner: 'dots12', color: 'cyan' }).start();
  let ip: string;
  try {
    ip = await resolveServerIp(hostname);
    if (!isJsonMode()) ipSpinner?.succeed(`${hostname} → ${ip}`);
    else ipSpinner?.stop();
  } catch (err: any) {
    ipSpinner?.fail(err.message);
    return;
  }

  // Check blacklists
  const total = getBlacklistCount();
  const blSpinner = isJsonMode()
    ? null
    : ora({ text: `Checking ${total} blacklists...`, spinner: 'dots12', color: 'cyan' }).start();

  try {
    const results = await checkAllBlacklists(ip);
    blSpinner?.stop();

    const listed = results.filter((r) => r.listed);

    if (isJsonMode()) {
      output('ip', ip);
      output('hostname', hostname);
      output(
        'results',
        results.map((r) => ({ list: r.list, listed: r.listed, response: r.response || null })),
      );
      output('listedCount', listed.length);
      output('totalChecked', total);
      return;
    }

    console.log('');
    for (const r of results) {
      const icon = r.listed ? theme.statusIcon('fail') : theme.statusIcon('pass');
      const status = r.listed ? theme.error(`LISTED (${r.response})`) : theme.success('Clean');
      console.log(`    ${icon} ${theme.bold(r.list.padEnd(20))} ${status}`);
    }

    console.log('');
    console.log(theme.separator());
    console.log('');

    if (listed.length === 0) {
      console.log(theme.success(`  ${theme.statusIcon('pass')} ${ip} is clean on all ${total} blacklists`));
    } else {
      console.log(
        theme.error(
          `  ${theme.statusIcon('fail')} ${ip} is listed on ${listed.length}/${total} blacklist${listed.length !== 1 ? 's' : ''}`,
        ),
      );
      console.log('');
      console.log(theme.subheading('What to do:'));
      console.log(theme.muted('    1. This is a shared MXroute server IP — contact MXroute support'));
      console.log(theme.muted('    2. Open a ticket at management.mxroute.com with the blacklist details'));
      console.log(theme.muted('    3. MXroute manages IP reputation via SNDS and delist requests'));
    }
    console.log('');
  } catch (err: any) {
    blSpinner?.fail('Blacklist check failed');
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}
