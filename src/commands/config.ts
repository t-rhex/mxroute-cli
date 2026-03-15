import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import {
  getConfig,
  setConfig,
  setProfile,
  switchProfile,
  getProfiles,
  deleteProfile,
  getConfigPath,
} from '../utils/config';
import { testAuth } from '../utils/directadmin';
import { validateEmail } from '../utils/shared';

export async function configSetup(): Promise<void> {
  console.log(theme.heading('Configure MXroute CLI'));

  const config = getConfig();

  // Step 1: Profile name
  const { profileName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'profileName',
      message: theme.secondary('Profile name:'),
      default: config.activeProfile || 'default',
    },
  ]);

  // Step 2: Server hostname (shared by both API and SMTP)
  const { server } = await inquirer.prompt([
    {
      type: 'input',
      name: 'server',
      message: theme.secondary('MXroute server hostname (e.g., tuesday, fusion):'),
      default: config.server || '',
      validate: (input: string) => (input.trim() ? true : 'Server hostname is required'),
      filter: (input: string) => input.replace('.mxrouting.net', '').replace(':2222', '').trim(),
    },
  ]);

  // Step 3: DirectAdmin API credentials (primary auth)
  console.log(theme.heading('DirectAdmin API Authentication'));
  console.log(theme.muted('  This is your primary authentication — gives access to all account management.'));
  console.log(theme.muted('  Create a Login Key at Control Panel (panel.mxroute.com) -> Login Keys\n'));

  const { daUsername, daLoginKey } = await inquirer.prompt([
    {
      type: 'input',
      name: 'daUsername',
      message: theme.secondary('DirectAdmin username:'),
      default: config.daUsername || '',
      validate: (input: string) => (input.trim() ? true : 'Username is required'),
    },
    {
      type: 'password',
      name: 'daLoginKey',
      message: theme.secondary('Login Key (API key):'),
      mask: '•',
      validate: (input: string) => (input.trim() ? true : 'Login key is required'),
    },
  ]);

  // Test API auth
  const spinner = ora({ text: 'Testing authentication...', spinner: 'dots12', color: 'cyan' }).start();
  let authOk = false;
  try {
    const result = await testAuth({ server, username: daUsername, loginKey: daLoginKey });
    if (result.success) {
      spinner.succeed(chalk.green('Authentication successful'));
      authOk = true;
    } else {
      spinner.fail(chalk.red(`Authentication failed: ${result.message}`));
    }
  } catch (err: any) {
    spinner.fail(chalk.red(`Connection failed: ${err.message}`));
  }

  // Step 4: Domain — auto-detect from API if authenticated
  let domain = config.domain || '';
  if (authOk) {
    try {
      const { listDomains } = require('../utils/directadmin');
      const domains = await listDomains({ server, username: daUsername, loginKey: daLoginKey });
      if (domains.length === 1) {
        domain = domains[0];
        console.log(theme.muted(`\n  Auto-detected domain: ${theme.bold(domain)}`));
      } else if (domains.length > 1) {
        const { selectedDomain } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedDomain',
            message: 'Select primary domain:',
            choices: domains,
          },
        ]);
        domain = selectedDomain;
      }
    } catch {
      // Fall back to manual entry
    }
  }

  if (!domain) {
    const { manualDomain } = await inquirer.prompt([
      {
        type: 'input',
        name: 'manualDomain',
        message: theme.secondary('Primary domain:'),
        validate: (input: string) => {
          if (!input.trim()) return 'Domain is required';
          if (!input.includes('.') || input.startsWith('.') || input.endsWith('.'))
            return 'Enter a valid domain (e.g., example.com)';
          return true;
        },
      },
    ]);
    domain = manualDomain;
  }

  // Step 5: SMTP credentials (optional — for sending email)
  console.log(theme.heading('SMTP Credentials (optional)'));
  console.log(theme.muted('  Only needed if you want to send email via CLI (mxroute send / mxroute test).'));
  console.log(theme.muted("  Uses a specific email account's credentials.\n"));

  const { setupSmtp } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'setupSmtp',
      message: 'Configure SMTP credentials now?',
      default: false,
    },
  ]);

  let smtpUsername = config.username || '';
  let smtpPassword = config.password || '';

  if (setupSmtp) {
    const smtpAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: theme.secondary('Email address (SMTP username):'),
        default: config.username || '',
        validate: validateEmail,
      },
      {
        type: 'password',
        name: 'password',
        message: theme.secondary('Email password:'),
        mask: '•',
      },
    ]);
    smtpUsername = smtpAnswers.username;
    smtpPassword = smtpAnswers.password;
  }

  // Save everything
  setProfile(profileName, {
    server,
    username: smtpUsername,
    password: smtpPassword,
    domain,
  });
  setConfig('daUsername', daUsername);
  setConfig('daLoginKey', daLoginKey);

  // Summary
  console.log('');
  const lines = [
    theme.keyValue('Profile', profileName, 0),
    theme.keyValue('Server', `${server}.mxrouting.net`, 0),
    theme.keyValue('DA Username', daUsername, 0),
    theme.keyValue('Login Key', '••••••••', 0),
    theme.keyValue('Domain', domain, 0),
  ];
  if (smtpUsername) {
    lines.push(theme.keyValue('SMTP Account', smtpUsername, 0));
  } else {
    lines.push(theme.keyValue('SMTP', theme.muted('not configured (run mxroute config smtp)'), 0));
  }
  console.log(theme.box(lines.join('\n'), 'Configuration Saved'));
  console.log('');
  console.log(theme.success(`  ${theme.statusIcon('pass')} Saved to ${theme.muted(getConfigPath())}`));
  console.log('');
  console.log(theme.subheading('Next steps:'));
  console.log(theme.muted('    mxroute domains list     List your domains'));
  console.log(theme.muted('    mxroute accounts list    List email accounts'));
  console.log(theme.muted('    mxroute dns check        Verify DNS records'));
  if (!smtpUsername) {
    console.log(theme.muted('    mxroute config smtp      Configure SMTP to send email'));
  }
  console.log('');
}

export async function configSmtp(): Promise<void> {
  console.log(theme.heading('Configure SMTP Credentials'));
  console.log(theme.muted('  Used for sending email via mxroute send / mxroute test.\n'));

  const config = getConfig();

  if (!config.server) {
    console.log(theme.error(`  ${theme.statusIcon('fail')} Run ${theme.bold('mxroute config setup')} first.\n`));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: theme.secondary('Email address (SMTP username):'),
      default: config.username || '',
      validate: (input: string) => (input.includes('@') ? true : 'Must be a full email address'),
    },
    {
      type: 'password',
      name: 'password',
      message: theme.secondary('Email password:'),
      mask: '•',
    },
  ]);

  setConfig('username', answers.username);
  setConfig('password', answers.password);

  // After setting config, also update the active profile
  const currentConfig = getConfig();
  const profiles = getProfiles();
  if (profiles[currentConfig.activeProfile]) {
    profiles[currentConfig.activeProfile].username = answers.username;
    profiles[currentConfig.activeProfile].password = answers.password;
    setConfig('profiles', profiles);
  }

  console.log(theme.success(`\n  ${theme.statusIcon('pass')} SMTP credentials saved for ${answers.username}\n`));
}

export async function configRemoveSmtp(): Promise<void> {
  const config = getConfig();

  if (!config.username && !config.password) {
    console.log(theme.muted('\n  No SMTP credentials configured.\n'));
    return;
  }

  console.log(theme.heading('Remove SMTP Credentials'));
  console.log(theme.keyValue('Current SMTP account', config.username));
  console.log('');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Remove SMTP credentials?',
      default: false,
    },
  ]);

  if (confirm) {
    setConfig('username', '');
    setConfig('password', '');

    const currentConfig = getConfig();
    const profiles = getProfiles();
    if (profiles[currentConfig.activeProfile]) {
      profiles[currentConfig.activeProfile].username = '';
      profiles[currentConfig.activeProfile].password = '';
      setConfig('profiles', profiles);
    }

    console.log(theme.success(`\n  ${theme.statusIcon('pass')} SMTP credentials removed.\n`));
  } else {
    console.log(theme.muted('\n  Cancelled.\n'));
  }
}

export async function configShow(): Promise<void> {
  const config = getConfig();
  console.log(theme.heading('Current Configuration'));

  if (!config.server && !config.daUsername) {
    console.log(
      theme.warning(
        `  ${theme.statusIcon('warn')} No configuration found. Run ${theme.bold('mxroute config setup')} first.`,
      ),
    );
    return;
  }

  const lines = [
    theme.keyValue('Profile', config.activeProfile, 0),
    theme.keyValue('Server', config.server ? `${config.server}.mxrouting.net` : theme.muted('not set'), 0),
    theme.keyValue('DA Username', config.daUsername || theme.muted('not set'), 0),
    theme.keyValue('Login Key', config.daLoginKey ? '••••••••' : theme.muted('not set'), 0),
    theme.keyValue('Domain', config.domain || theme.muted('not set'), 0),
    theme.keyValue('SMTP Account', config.username || theme.muted('not configured'), 0),
    theme.keyValue('SMTP Password', config.password ? '••••••••' : theme.muted('not set'), 0),
    theme.keyValue('Config file', getConfigPath(), 0),
  ];

  console.log(theme.box(lines.join('\n'), 'Active Profile'));
  console.log('');
}

export async function configProfiles(): Promise<void> {
  const profiles = getProfiles();
  const active = getConfig().activeProfile;
  const config = getConfig();

  console.log(theme.heading('Profiles'));

  if (Object.keys(profiles).length === 0) {
    console.log(
      theme.warning(`  ${theme.statusIcon('warn')} No profiles configured. Run ${theme.bold('mxroute config setup')}`),
    );
    return;
  }

  for (const [name, profile] of Object.entries(profiles) as [string, any][]) {
    const isActive = name === active;
    const marker = isActive ? theme.success(' ● active') : '';
    const lines = [
      theme.keyValue('Server', `${profile.server}.mxrouting.net`, 0),
      theme.keyValue('Domain', profile.domain, 0),
    ];
    if (isActive && config.daUsername) {
      lines.push(theme.keyValue('DA Username', config.daUsername, 0));
    }
    if (profile.username) {
      lines.push(theme.keyValue('SMTP Account', profile.username, 0));
    }
    console.log(theme.box(lines.join('\n'), `${name}${marker}`));
    console.log('');
  }
}

export async function configSwitch(name?: string): Promise<void> {
  const profiles = getProfiles();

  if (Object.keys(profiles).length === 0) {
    console.log(theme.error(`  ${theme.statusIcon('fail')} No profiles to switch to.`));
    return;
  }

  if (!name) {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'Select profile:',
        choices: Object.keys(profiles),
      },
    ]);
    name = answer.profile;
  }

  if (switchProfile(name!)) {
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Switched to profile: ${theme.bold(name!)}\n`));
  } else {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Profile "${name}" not found.\n`));
  }
}

export async function configDelete(name?: string): Promise<void> {
  const profiles = getProfiles();

  if (!name) {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'Select profile to delete:',
        choices: Object.keys(profiles),
      },
    ]);
    name = answer.profile;
  }

  if (deleteProfile(name!)) {
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Deleted profile: ${name}\n`));
  } else {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Profile "${name}" not found.\n`));
  }
}
