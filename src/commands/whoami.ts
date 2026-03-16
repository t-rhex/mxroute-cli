import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { getCreds } from '../utils/shared';
import { listDomains, getQuotaUsage } from '../utils/directadmin';
import { isJsonMode, output } from '../utils/json-output';

export async function whoamiCommand(): Promise<void> {
  const config = getConfig();

  if (!config.server && !config.daUsername) {
    console.log(
      theme.error(`\n  ${theme.statusIcon('fail')} Not configured. Run ${theme.bold('mxroute config setup')}\n`),
    );
    return;
  }

  if (!isJsonMode()) {
    console.log(theme.heading('Who Am I'));
    console.log(theme.keyValue('Server', config.server ? `${config.server}.mxrouting.net` : 'not set'));
    console.log(theme.keyValue('Profile', config.activeProfile));
  }

  if (config.daUsername && config.daLoginKey) {
    if (!isJsonMode()) console.log(theme.keyValue('DA User', config.daUsername));

    const spinner = isJsonMode()
      ? null
      : ora({ text: 'Fetching account info...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const creds = getCreds();
      const [domains, usage] = await Promise.all([listDomains(creds), getQuotaUsage(creds)]);
      spinner?.stop();

      if (isJsonMode()) {
        output('server', config.server ? `${config.server}.mxrouting.net` : null);
        output('profile', config.activeProfile);
        output('daUser', config.daUsername);
        output('domains', domains);
        output('diskUsed', `${usage.quota || usage.disk || '?'} MB`);
        if (config.username) {
          output('smtpAccount', config.username);
        }
        return;
      }

      console.log(theme.keyValue('Domains', domains.join(', ')));
      console.log(theme.keyValue('Disk Used', `${usage.quota || usage.disk || '?'} MB`));
    } catch {
      spinner?.stop();
    }
  } else if (isJsonMode()) {
    output('server', config.server ? `${config.server}.mxrouting.net` : null);
    output('profile', config.activeProfile);
    output('daUser', null);
    output('domains', []);
    output('diskUsed', null);
    if (config.username) {
      output('smtpAccount', config.username);
    }
    return;
  }

  if (!isJsonMode()) {
    if (config.username) {
      console.log(theme.keyValue('SMTP Account', config.username));
    }

    console.log('');
  }
}
