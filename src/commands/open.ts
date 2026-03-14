import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';

export async function openCommand(target?: string): Promise<void> {
  const config = getConfig();
  const server = config.server ? `${config.server}.mxrouting.net` : '';

  const urls: Record<string, { url: string; label: string }> = {
    panel: { url: 'https://panel.mxroute.com', label: 'Control Panel' },
    management: { url: 'https://management.mxroute.com', label: 'Management Panel' },
    webmail: {
      url: server ? `https://${server}/roundcube` : 'https://panel.mxroute.com',
      label: 'Webmail (Roundcube)',
    },
    crossbox: { url: server ? `https://${server}/crossbox` : 'https://panel.mxroute.com', label: 'Webmail (Crossbox)' },
    whitelist: { url: 'https://whitelistrequest.mxrouting.net', label: 'Whitelist Request' },
    mailtester: { url: 'https://mail-tester.com', label: 'Mail Tester' },
  };

  if (!target) {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Open:',
        choices: Object.entries(urls).map(([key, val]) => ({
          name: `${val.label} (${val.url})`,
          value: key,
        })),
      },
    ]);
    target = selected;
  }

  const entry = urls[target!];
  if (!entry) {
    console.log(theme.error(`\n  Unknown target. Options: ${Object.keys(urls).join(', ')}\n`));
    return;
  }

  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    execSync(`${cmd} "${entry.url}"`, { stdio: 'ignore' });
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Opened ${entry.label}\n`));
  } catch {
    console.log(theme.muted(`\n  Open manually: ${entry.url}\n`));
  }
}
