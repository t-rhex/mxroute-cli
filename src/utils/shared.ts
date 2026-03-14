import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from './theme';
import { getConfig } from './config';
import { listDomains, DACredentials } from './directadmin';

export function getCreds(): DACredentials {
  const config = getConfig();
  if (!config.daUsername || !config.daLoginKey) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} Not authenticated. Run ${theme.bold('mxroute config setup')} first.\n`,
      ),
    );
    process.exit(1);
  }
  return { server: config.server, username: config.daUsername, loginKey: config.daLoginKey };
}

export async function pickDomain(creds: DACredentials, domain?: string): Promise<string> {
  if (domain) return domain;

  const config = getConfig();
  if (config.domain) return config.domain;

  const spinner = ora({ text: 'Fetching domains...', spinner: 'dots12', color: 'cyan' }).start();
  const domains = await listDomains(creds);
  spinner.stop();

  if (domains.length === 0) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} No domains found.\n`));
    process.exit(1);
  }

  if (domains.length === 1) return domains[0];

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: 'Select domain:',
      choices: domains,
    },
  ]);

  return selected;
}

export const tableChars = {
  top: '─',
  'top-mid': '┬',
  'top-left': '  ┌',
  'top-right': '┐',
  bottom: '─',
  'bottom-mid': '┴',
  'bottom-left': '  └',
  'bottom-right': '┘',
  left: '  │',
  'left-mid': '  ├',
  mid: '─',
  'mid-mid': '┼',
  right: '│',
  'right-mid': '┤',
  middle: '│',
};
