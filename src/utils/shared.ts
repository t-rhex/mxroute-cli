import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from './theme';
import { getConfig } from './config';
import { listDomains, DACredentials } from './directadmin';
import { isJsonMode, outputError } from './json-output';

export function getCreds(): DACredentials {
  const config = getConfig();
  if (!config.daUsername || !config.daLoginKey) {
    if (isJsonMode()) {
      outputError('AUTH_REQUIRED', 'Not authenticated. Run mxroute config setup first.');
      return { server: '', username: '', loginKey: '' };
    }
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

  if (isJsonMode()) {
    outputError('MISSING_ARG', 'domain argument required');
    return '';
  }

  const spinner = ora({ text: 'Fetching domains...', spinner: 'dots12', color: 'cyan' }).start();
  const domains = await listDomains(creds);
  spinner.stop();

  if (domains.length === 0) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} No domains found on this account.`));
    console.log(theme.muted(`  Add a domain via Control Panel (panel.mxroute.com) first.\n`));
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

/**
 * Validates an email address format.
 * Returns true if valid, or an error message string if invalid.
 */
export function validateEmail(input: string): true | string {
  if (!input.trim()) return 'Email address is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input)) return 'Enter a valid email address (e.g., user@example.com)';
  return true;
}

/**
 * Validates a domain name format.
 * Returns true if valid, or an error message string if invalid.
 */
export function validateDomain(input: string): true | string {
  if (!input.trim()) return 'Domain is required';
  const domainRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(input)) return 'Enter a valid domain (e.g., example.com)';
  return true;
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
