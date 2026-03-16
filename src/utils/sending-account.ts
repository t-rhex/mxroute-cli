import { getConfig, setConfig, getProfiles } from './config';

export interface SendingAccount {
  email: string;
  password: string;
  server: string;
}

/**
 * Check if a sending account is configured (non-interactive, for display/guard checks).
 */
export function hasSendingAccount(): boolean {
  const config = getConfig();
  return !!(config.server && config.username && config.password);
}

/**
 * Get the configured sending account. Returns null if not configured.
 * Use this for non-interactive contexts (MCP tools, --json mode, monitors).
 */
export function getSendingAccountSync(): SendingAccount | null {
  const config = getConfig();
  if (!config.server || !config.username || !config.password) return null;
  return {
    email: config.username,
    password: config.password,
    server: `${config.server}.mxrouting.net`,
  };
}

/**
 * Get sending account — prompts user to pick one if not configured.
 * This is the main function commands should call.
 *
 * Flow:
 * 1. If already configured in config → return it
 * 2. If DA API configured → list accounts, let user pick, ask password, save
 * 3. If no DA API → ask for email + password manually, save
 */
export async function getSendingAccount(): Promise<SendingAccount> {
  // Check if already configured
  const existing = getSendingAccountSync();
  if (existing) return existing;

  const config = getConfig();
  if (!config.server) {
    throw new Error('Server not configured. Run: mxroute config setup');
  }

  const inquirer = (await import('inquirer')).default;
  const { theme } = await import('./theme');

  console.log(theme.heading('Set Up Sending Account'));
  console.log(theme.muted('  To send email, you need to choose which email account to send from.\n'));

  let email: string;

  // If DA API is configured, list accounts and let user pick
  if (config.daUsername && config.daLoginKey) {
    try {
      const { listDomains, listEmailAccounts } = await import('./directadmin');
      const ora = (await import('ora')).default;
      const spinner = ora({ text: 'Fetching your email accounts...', spinner: 'dots12', color: 'cyan' }).start();

      const creds = { server: config.server, username: config.daUsername, loginKey: config.daLoginKey };
      const domains = await listDomains(creds);
      const allAccounts: string[] = [];
      for (const domain of domains) {
        const accounts = await listEmailAccounts(creds, domain);
        allAccounts.push(...accounts.map((a) => `${a}@${domain}`));
      }
      spinner.stop();

      if (allAccounts.length > 0) {
        const { selected } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selected',
            message: 'Send from which account?',
            choices: allAccounts,
          },
        ]);
        email = selected;
      } else {
        // No accounts found, ask manually
        const { manualEmail } = await inquirer.prompt([
          {
            type: 'input',
            name: 'manualEmail',
            message: theme.secondary('Email address to send from:'),
            validate: (input: string) => (input.includes('@') ? true : 'Enter a full email address'),
          },
        ]);
        email = manualEmail;
      }
    } catch {
      // DA API failed, fall back to manual
      const { manualEmail } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualEmail',
          message: theme.secondary('Email address to send from:'),
          validate: (input: string) => (input.includes('@') ? true : 'Enter a full email address'),
        },
      ]);
      email = manualEmail;
    }
  } else {
    // No DA API, ask manually
    const { manualEmail } = await inquirer.prompt([
      {
        type: 'input',
        name: 'manualEmail',
        message: theme.secondary('Email address to send from:'),
        validate: (input: string) => (input.includes('@') ? true : 'Enter a full email address'),
      },
    ]);
    email = manualEmail;
  }

  // Ask for password
  const { password } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: theme.secondary(`Password for ${email}:`),
      mask: '•',
      validate: (input: string) => (input.trim() ? true : 'Password is required'),
    },
  ]);

  // Save to config
  setConfig('username', email);
  setConfig('password', password);

  // Also update the active profile
  const profiles = getProfiles();
  const activeProfile = config.activeProfile;
  if (profiles[activeProfile]) {
    profiles[activeProfile].username = email;
    profiles[activeProfile].password = password;
    setConfig('profiles', profiles);
  }

  // Set domain if not set
  if (!config.domain) {
    const domain = email.split('@')[1];
    if (domain) setConfig('domain', domain);
  }

  console.log(theme.success(`\n  ${theme.statusIcon('pass')} Sending account set: ${email}\n`));

  return {
    email,
    password,
    server: `${config.server}.mxrouting.net`,
  };
}
