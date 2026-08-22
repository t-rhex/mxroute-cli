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
import { testAuth } from '../utils/management';

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
  console.log(theme.subheading('Server Hostname'));
  console.log(theme.muted('  Find yours at panel.mxroute.com → DNS section.'));
  console.log(theme.muted('  It looks like: tuesday, fusion, arrow, etc.\n'));
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

  // Step 3: Management API credentials
  const { managementBackend } = await inquirer.prompt([
    {
      type: 'list',
      name: 'managementBackend',
      message: theme.secondary('Account management connection:'),
      choices: [
        { name: 'MXroute API Key (recommended)', value: 'mxroute-api' },
        { name: 'DirectAdmin Login Key (legacy features)', value: 'directadmin' },
      ],
    },
  ]);

  let managementCreds: any;
  let managementUsername = '';
  if (managementBackend === 'mxroute-api') {
    console.log(theme.heading('MXroute API Authentication'));
    console.log(theme.muted('  Create a key at panel.mxroute.com → Advanced → API Keys.'));
    console.log(theme.muted('  Use the exact server hostname displayed on that page.\n'));
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiServer',
        message: theme.secondary('API server (e.g., eagle.mxlogin.com):'),
        default: config.apiServer || '',
        validate: (input: string) => (input.trim() ? true : 'API server is required'),
        filter: (input: string) => input.trim(),
      },
      {
        type: 'input',
        name: 'apiUsername',
        message: theme.secondary('API username:'),
        default: config.apiUsername || config.daUsername || '',
        validate: (input: string) => (input.trim() ? true : 'Username is required'),
      },
      {
        type: 'password',
        name: 'apiKey',
        message: theme.secondary('API key:'),
        mask: '•',
        validate: (input: string) => (input.trim() ? true : 'API key is required'),
      },
    ]);
    managementUsername = answers.apiUsername;
    managementCreds = {
      backend: 'mxroute-api',
      server: answers.apiServer,
      username: answers.apiUsername,
      apiKey: answers.apiKey,
      ...(config.daUsername && config.daLoginKey
        ? { legacy: { server, username: config.daUsername, loginKey: config.daLoginKey } }
        : {}),
    };
  } else {
    console.log(theme.heading('Legacy DirectAdmin Authentication'));
    console.log(theme.muted('  Retain this only for features not available in the current MXroute API.\n'));
    const answers = await inquirer.prompt([
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
        message: theme.secondary('DirectAdmin Login Key:'),
        mask: '•',
        validate: (input: string) => (input.trim() ? true : 'Login key is required'),
      },
    ]);
    managementUsername = answers.daUsername;
    managementCreds = { server, username: answers.daUsername, loginKey: answers.daLoginKey };
  }

  // Test API auth
  const spinner = ora({ text: 'Testing authentication...', spinner: 'dots12', color: 'cyan' }).start();
  let authOk = false;
  try {
    const result = await testAuth(managementCreds);
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
      const { listDomains } = require('../utils/management');
      const domains = await listDomains(managementCreds);
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

  // Save everything
  setProfile(profileName, {
    server,
    username: config.username || '',
    password: config.password || '',
    domain,
  });
  setConfig('managementBackend', managementBackend);
  if (managementBackend === 'mxroute-api') {
    setConfig('apiServer', managementCreds.server);
    setConfig('apiUsername', managementCreds.username);
    setConfig('apiKey', managementCreds.apiKey);
  } else {
    setConfig('daUsername', managementCreds.username);
    setConfig('daLoginKey', managementCreds.loginKey);
  }

  // Summary
  console.log('');
  const lines = [
    theme.keyValue('Profile', profileName, 0),
    theme.keyValue('Server', `${server}.mxrouting.net`, 0),
    theme.keyValue('Management API', managementBackend === 'mxroute-api' ? 'MXroute API' : 'DirectAdmin (legacy)', 0),
    theme.keyValue('API Username', managementUsername, 0),
    theme.keyValue('API Key', '••••••••', 0),
    theme.keyValue('Domain', domain, 0),
  ];
  console.log(theme.box(lines.join('\n'), 'Configuration Saved'));
  console.log('');
  console.log(theme.success(`  ${theme.statusIcon('pass')} Saved to ${theme.muted(getConfigPath())}`));
  console.log('');
  console.log(theme.subheading('Next steps:'));
  console.log(theme.muted('    mxroute domains list     List your domains'));
  console.log(theme.muted('    mxroute accounts list    List email accounts'));
  console.log(theme.muted('    mxroute dns check        Verify DNS records'));
  console.log('');
}

export async function configSendingAccount(): Promise<void> {
  console.log(theme.heading('Configure Sending Account'));
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
      message: theme.secondary('Email address to send from:'),
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

  console.log(theme.success(`\n  ${theme.statusIcon('pass')} Sending account saved for ${answers.username}\n`));
}

export async function configRemoveSendingAccount(): Promise<void> {
  const config = getConfig();

  if (!config.username && !config.password) {
    console.log(theme.muted('\n  No sending account configured.\n'));
    return;
  }

  console.log(theme.heading('Remove Sending Account'));
  console.log(theme.keyValue('Current sending account', config.username));
  console.log('');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Remove sending account?',
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

    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Sending account removed.\n`));
  } else {
    console.log(theme.muted('\n  Cancelled.\n'));
  }
}

export async function configShow(): Promise<void> {
  const config = getConfig();
  console.log(theme.heading('Current Configuration'));

  if (!config.server && !config.daUsername && !config.apiKey) {
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
    theme.keyValue(
      'Management API',
      config.managementBackend === 'mxroute-api' ? 'MXroute API' : 'DirectAdmin (legacy)',
      0,
    ),
    theme.keyValue(
      'API Server',
      config.managementBackend === 'mxroute-api'
        ? config.apiServer || theme.muted('not set')
        : config.server
          ? `${config.server}.mxrouting.net:2222`
          : theme.muted('not set'),
      0,
    ),
    theme.keyValue(
      'API Username',
      (config.managementBackend === 'mxroute-api' ? config.apiUsername : config.daUsername) || theme.muted('not set'),
      0,
    ),
    theme.keyValue(
      'API Key',
      (config.managementBackend === 'mxroute-api' ? config.apiKey : config.daLoginKey)
        ? '••••••••'
        : theme.muted('not set'),
      0,
    ),
    theme.keyValue('Legacy DirectAdmin', config.daLoginKey ? 'configured' : theme.muted('not configured'), 0),
    theme.keyValue('Domain', config.domain || theme.muted('not set'), 0),
    theme.keyValue('Sending Account', config.username || theme.muted('not configured'), 0),
    theme.keyValue('Sending Password', config.password ? '••••••••' : theme.muted('not set'), 0),
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
      lines.push(theme.keyValue('Sending Account', profile.username, 0));
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
