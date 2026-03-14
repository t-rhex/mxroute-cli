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

export async function configSetup(): Promise<void> {
  console.log(theme.heading('Configure MXroute CLI'));

  const config = getConfig();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'profileName',
      message: theme.secondary('Profile name:'),
      default: config.activeProfile || 'default',
    },
    {
      type: 'input',
      name: 'server',
      message: theme.secondary('MXroute server hostname:'),
      default: config.server || '',
      validate: (input: string) => {
        if (!input.trim()) return 'Server hostname is required (e.g., tuesday)';
        return true;
      },
      filter: (input: string) => input.replace('.mxrouting.net', '').trim(),
    },
    {
      type: 'input',
      name: 'username',
      message: theme.secondary('Email address (SMTP username):'),
      default: config.username || '',
      validate: (input: string) => {
        if (!input.includes('@')) return 'Must be a full email address';
        return true;
      },
    },
    {
      type: 'password',
      name: 'password',
      message: theme.secondary('Password:'),
      mask: '•',
    },
    {
      type: 'input',
      name: 'domain',
      message: theme.secondary('Primary domain:'),
      default: (answers: any) => {
        const username = answers.username || config.username || '';
        return username.split('@')[1] || config.domain || '';
      },
    },
  ]);

  setProfile(answers.profileName, {
    server: answers.server,
    username: answers.username,
    password: answers.password,
    domain: answers.domain,
  });

  console.log('');
  console.log(
    theme.box(
      [
        theme.keyValue('Profile', answers.profileName, 0),
        theme.keyValue('Server', `${answers.server}.mxrouting.net`, 0),
        theme.keyValue('Username', answers.username, 0),
        theme.keyValue('Domain', answers.domain, 0),
        theme.keyValue('Password', '••••••••', 0),
      ].join('\n'),
      'Configuration Saved',
    ),
  );
  console.log('');
  console.log(theme.success(`  ${theme.statusIcon('pass')} Configuration saved to ${theme.muted(getConfigPath())}`));
  console.log('');
}

export async function configShow(): Promise<void> {
  const config = getConfig();
  console.log(theme.heading('Current Configuration'));

  if (!config.server) {
    console.log(
      theme.warning(
        `  ${theme.statusIcon('warn')} No configuration found. Run ${theme.bold('mxroute config setup')} first.`,
      ),
    );
    return;
  }

  console.log(
    theme.box(
      [
        theme.keyValue('Profile', config.activeProfile, 0),
        theme.keyValue('Server', config.server ? `${config.server}.mxrouting.net` : theme.muted('not set'), 0),
        theme.keyValue('Username', config.username || theme.muted('not set'), 0),
        theme.keyValue('Domain', config.domain || theme.muted('not set'), 0),
        theme.keyValue('Password', config.password ? '••••••••' : theme.muted('not set'), 0),
        theme.keyValue('Config file', getConfigPath(), 0),
      ].join('\n'),
      'Active Profile',
    ),
  );
  console.log('');
}

export async function configProfiles(): Promise<void> {
  const profiles = getProfiles();
  const active = getConfig().activeProfile;

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
    console.log(
      theme.box(
        [
          theme.keyValue('Server', `${profile.server}.mxrouting.net`, 0),
          theme.keyValue('Username', profile.username, 0),
          theme.keyValue('Domain', profile.domain, 0),
        ].join('\n'),
        `${name}${marker}`,
      ),
    );
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
