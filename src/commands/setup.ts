import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { theme } from '../utils/theme';
import { getConfig, setConfig, setProfile } from '../utils/config';
import { testAuth } from '../utils/directadmin';

// ─── Tool detection ──────────────────────────────────────

interface DetectedTool {
  name: string;
  id: string;
  mcpConfigPath: string;
  mcpConfigKey: string;
  rulesPath: string | null;
  rulesFormat: 'skill-md' | 'mdc' | 'single-md' | 'yaml-ref' | null;
  detected: boolean;
}

function detectTools(): DetectedTool[] {
  const home = os.homedir();
  const platform = process.platform;

  const tools: DetectedTool[] = [
    {
      name: 'Claude Code',
      id: 'claude-code',
      mcpConfigPath: path.join(home, '.claude', 'settings.json'),
      mcpConfigKey: 'mcpServers',
      rulesPath: path.join(home, '.claude', 'skills'),
      rulesFormat: 'skill-md',
      detected: fs.existsSync(path.join(home, '.claude')),
    },
    {
      name: 'Claude Desktop',
      id: 'claude-desktop',
      mcpConfigPath:
        platform === 'darwin'
          ? path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
          : platform === 'win32'
            ? path.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
            : path.join(home, '.config', 'claude', 'claude_desktop_config.json'),
      mcpConfigKey: 'mcpServers',
      rulesPath: null,
      rulesFormat: null,
      detected:
        platform === 'darwin'
          ? fs.existsSync(path.join(home, 'Library', 'Application Support', 'Claude'))
          : platform === 'win32'
            ? fs.existsSync(path.join(home, 'AppData', 'Roaming', 'Claude'))
            : false,
    },
    {
      name: 'Cursor',
      id: 'cursor',
      mcpConfigPath: path.join(process.cwd(), '.cursor', 'mcp.json'),
      mcpConfigKey: 'mcpServers',
      rulesPath: path.join(process.cwd(), '.cursor', 'rules'),
      rulesFormat: 'mdc',
      detected: fs.existsSync(path.join(home, '.cursor')) || fs.existsSync(path.join(process.cwd(), '.cursor')),
    },
    {
      name: 'Windsurf',
      id: 'windsurf',
      mcpConfigPath:
        platform === 'darwin'
          ? path.join(home, '.codeium', 'windsurf', 'mcp_config.json')
          : path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      mcpConfigKey: 'mcpServers',
      rulesPath: path.join(process.cwd(), '.windsurfrules'),
      rulesFormat: 'single-md',
      detected: fs.existsSync(path.join(home, '.codeium', 'windsurf')),
    },
    {
      name: 'OpenCode',
      id: 'opencode',
      mcpConfigPath: path.join(process.cwd(), 'opencode.json'),
      mcpConfigKey: 'mcpServers',
      rulesPath: path.join(process.cwd(), 'AGENTS.md'),
      rulesFormat: 'single-md',
      detected: fs.existsSync(path.join(process.cwd(), 'opencode.json')) || commandExists('opencode'),
    },
    {
      name: 'Cline / Roo Code',
      id: 'cline',
      mcpConfigPath:
        platform === 'darwin'
          ? path.join(
              home,
              'Library',
              'Application Support',
              'Code',
              'User',
              'globalStorage',
              'saoudrizwan.claude-dev',
              'settings',
              'cline_mcp_settings.json',
            )
          : path.join(
              home,
              '.vscode',
              'globalStorage',
              'saoudrizwan.claude-dev',
              'settings',
              'cline_mcp_settings.json',
            ),
      mcpConfigKey: 'mcpServers',
      rulesPath: path.join(process.cwd(), '.clinerules'),
      rulesFormat: 'single-md',
      detected:
        fs.existsSync(path.join(process.cwd(), '.clinerules')) ||
        (platform === 'darwin' &&
          fs.existsSync(
            path.join(
              home,
              'Library',
              'Application Support',
              'Code',
              'User',
              'globalStorage',
              'saoudrizwan.claude-dev',
            ),
          )),
    },
    {
      name: 'Continue.dev',
      id: 'continue',
      mcpConfigPath: path.join(home, '.continue', 'config.json'),
      mcpConfigKey: 'experimental.modelContextProtocolServers',
      rulesPath: path.join(home, '.continue', 'rules'),
      rulesFormat: 'single-md',
      detected: fs.existsSync(path.join(home, '.continue')),
    },
    {
      name: 'Aider',
      id: 'aider',
      mcpConfigPath: '',
      mcpConfigKey: '',
      rulesPath: path.join(process.cwd(), '.aider.conf.yml'),
      rulesFormat: 'yaml-ref',
      detected: commandExists('aider'),
    },
  ];

  return tools;
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ─── MXroute instructions content ────────────────────────

function getMxrouteInstructions(): string {
  return `# MXroute Email Hosting

You have access to MXroute email hosting management via the \`mxroute\` CLI and MCP tools.

## Available MCP Tools
- \`list_domains\`, \`domain_info\` — domain management
- \`list_email_accounts\`, \`create_email_account\`, \`delete_email_account\`, \`change_email_password\`, \`set_email_quota\` — email accounts
- \`list_forwarders\`, \`create_forwarder\`, \`delete_forwarder\` — email forwarding
- \`list_autoresponders\`, \`create_autoresponder\`, \`delete_autoresponder\` — vacation messages
- \`get_catchall\`, \`set_catchall\` — catch-all / default address
- \`get_spam_config\`, \`set_spam_config\` — SpamAssassin settings
- \`dns_health_check\`, \`list_dns_records\`, \`add_dns_record\`, \`delete_dns_record\`, \`get_dkim_key\` — DNS management
- \`list_email_filters\`, \`create_email_filter\`, \`delete_email_filter\` — email filters
- \`list_mailing_lists\`, \`create_mailing_list\`, \`delete_mailing_list\`, \`list_mailing_list_members\`, \`add_mailing_list_member\`, \`remove_mailing_list_member\` — mailing lists
- \`list_domain_aliases\`, \`add_domain_alias\`, \`remove_domain_alias\` — domain pointers
- \`get_quota\` — account usage stats
- \`send_email\` — send email via SMTP API

## CLI Commands
Run \`mxroute --help\` for the full command list. Key commands:
- \`mxroute domains list\` — list domains
- \`mxroute accounts list [domain]\` — list email accounts
- \`mxroute dns check [domain]\` — verify MX, SPF, DKIM, DMARC
- \`mxroute send\` — send email
- \`mxroute troubleshoot\` — interactive troubleshooting wizard

## Key Reference
- SMTP API: https://smtpapi.mxroute.com/ (POST, JSON, 400/hr limit)
- Management Panel: https://management.mxroute.com
- Control Panel: https://panel.mxroute.com
- IMAP: port 993 SSL/TLS, SMTP: port 465 SSL/TLS
- SPF: \`v=spf1 include:mxroute.com -all\`
- DKIM selector: \`x._domainkey\`
- CalDAV/CardDAV: dav.mxroute.com
- Marketing email is prohibited
`;
}

// ─── Install functions ───────────────────────────────────

function getMcpBinPath(): string {
  try {
    const npmGlobalBin = execSync('npm bin -g', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    return path.join(npmGlobalBin, 'mxroute-mcp');
  } catch {
    return 'mxroute-mcp';
  }
}

function getMcpServerConfig(mcpBin: string): any {
  return {
    command: mcpBin,
    args: [],
  };
}

function installMcp(tool: DetectedTool, mcpBin: string): boolean {
  if (!tool.mcpConfigPath || !tool.mcpConfigKey) {
    console.log(theme.muted(`    ${tool.name}: MCP not supported via config file`));
    return false;
  }

  try {
    const dir = path.dirname(tool.mcpConfigPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let config: any = {};
    if (fs.existsSync(tool.mcpConfigPath)) {
      config = JSON.parse(fs.readFileSync(tool.mcpConfigPath, 'utf-8'));
    }

    // Handle nested keys like "experimental.modelContextProtocolServers"
    const keys = tool.mcpConfigKey.split('.');
    let target = config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) target[keys[i]] = {};
      target = target[keys[i]];
    }
    const lastKey = keys[keys.length - 1];

    if (!target[lastKey]) target[lastKey] = {};

    if (tool.id === 'continue') {
      // Continue.dev uses array format
      if (!Array.isArray(target[lastKey])) target[lastKey] = [];
      const existing = target[lastKey].findIndex((s: any) => s.name === 'mxroute');
      const entry = { name: 'mxroute', command: mcpBin, args: [] };
      if (existing >= 0) {
        target[lastKey][existing] = entry;
      } else {
        target[lastKey].push(entry);
      }
    } else {
      target[lastKey].mxroute = getMcpServerConfig(mcpBin);
    }

    fs.writeFileSync(tool.mcpConfigPath, JSON.stringify(config, null, 2));
    console.log(theme.success(`    ${theme.statusIcon('pass')} ${tool.name}: MCP server configured`));
    console.log(theme.muted(`       ${tool.mcpConfigPath}`));
    return true;
  } catch (err: any) {
    console.log(theme.error(`    ${theme.statusIcon('fail')} ${tool.name}: ${err.message}`));
    return false;
  }
}

function installRules(tool: DetectedTool): boolean {
  if (!tool.rulesPath || !tool.rulesFormat) return false;

  const content = getMxrouteInstructions();

  try {
    switch (tool.rulesFormat) {
      case 'skill-md': {
        // Claude Code: multiple skill files in directory
        if (!fs.existsSync(tool.rulesPath)) {
          fs.mkdirSync(tool.rulesPath, { recursive: true });
        }
        const skillFile = path.join(tool.rulesPath, 'mxroute.md');
        fs.writeFileSync(
          skillFile,
          `---\nname: mxroute\ndescription: |\n  MXroute email hosting management. Use when the user needs help with email accounts, DNS, sending, or troubleshooting.\n---\n\n${content}`,
        );
        console.log(theme.success(`    ${theme.statusIcon('pass')} ${tool.name}: Skill installed`));
        console.log(theme.muted(`       ${skillFile}`));
        return true;
      }

      case 'mdc': {
        // Cursor: .mdc files in .cursor/rules/
        if (!fs.existsSync(tool.rulesPath)) {
          fs.mkdirSync(tool.rulesPath, { recursive: true });
        }
        const ruleFile = path.join(tool.rulesPath, 'mxroute.mdc');
        const mdcContent = `---\ndescription: MXroute email hosting management\nglobs:\n  - "**/*"\nalwaysApply: false\n---\n\n${content}`;
        fs.writeFileSync(ruleFile, mdcContent);
        console.log(theme.success(`    ${theme.statusIcon('pass')} ${tool.name}: Rule installed`));
        console.log(theme.muted(`       ${ruleFile}`));
        return true;
      }

      case 'single-md': {
        // Windsurf, OpenCode, Cline: single file, append
        const marker = '<!-- mxroute-cli -->';
        const block = `\n${marker}\n${content}${marker}\n`;

        if (fs.existsSync(tool.rulesPath)) {
          let existing = fs.readFileSync(tool.rulesPath, 'utf-8');
          // Replace existing block or append
          const markerRegex = new RegExp(`\n?${escapeRegex(marker)}[\\s\\S]*?${escapeRegex(marker)}\n?`);
          if (markerRegex.test(existing)) {
            existing = existing.replace(markerRegex, block);
          } else {
            existing += block;
          }
          fs.writeFileSync(tool.rulesPath, existing);
        } else {
          const dir = path.dirname(tool.rulesPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(tool.rulesPath, block.trim() + '\n');
        }
        console.log(theme.success(`    ${theme.statusIcon('pass')} ${tool.name}: Instructions installed`));
        console.log(theme.muted(`       ${tool.rulesPath}`));
        return true;
      }

      case 'yaml-ref': {
        // Aider: just inform, can't auto-configure well
        console.log(theme.muted(`    ${theme.statusIcon('info')} ${tool.name}: Add to .aider.conf.yml:`));
        console.log(theme.muted(`       read: [".aider-mxroute.md"]`));
        // Write the reference file
        const refFile = path.join(process.cwd(), '.aider-mxroute.md');
        fs.writeFileSync(refFile, content);
        console.log(theme.success(`    ${theme.statusIcon('pass')} Reference file created: ${refFile}`));
        return true;
      }
    }
  } catch (err: any) {
    console.log(theme.error(`    ${theme.statusIcon('fail')} ${tool.name}: ${err.message}`));
  }
  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Setup Wizard ────────────────────────────────────────

export async function setupWizard(): Promise<void> {
  console.log(theme.banner());
  console.log(theme.heading('Setup Wizard'));
  console.log(theme.muted('  Configure MXroute CLI, MCP server, and AI tool integrations.\n'));

  // Detect tools
  const tools = detectTools();
  const detected = tools.filter((t) => t.detected);

  if (detected.length > 0) {
    console.log(theme.subheading('Detected AI tools:'));
    for (const t of detected) {
      console.log(theme.success(`    ${theme.statusIcon('pass')} ${t.name}`));
    }
    console.log('');
  }

  // Step 1: What to set up
  const { components } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'components',
      message: 'What would you like to set up?',
      choices: [
        { name: 'CLI Configuration (SMTP credentials for sending email)', value: 'cli', checked: true },
        { name: 'DirectAdmin API Authentication (account management)', value: 'auth', checked: true },
        { name: 'MCP Server (for AI coding tools)', value: 'mcp', checked: true },
        { name: 'AI Tool Instructions / Skills', value: 'rules', checked: true },
      ],
    },
  ]);

  // Step 2: CLI Config
  if (components.includes('cli')) {
    console.log(theme.heading('SMTP Configuration'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'server',
        message: theme.secondary('MXroute server hostname (e.g., tuesday, fusion):'),
        default: getConfig().server || '',
        validate: (input: string) => (input.trim() ? true : 'Required'),
        filter: (input: string) => input.replace('.mxrouting.net', '').trim(),
      },
      {
        type: 'input',
        name: 'username',
        message: theme.secondary('Email address (SMTP username):'),
        default: getConfig().username || '',
        validate: (input: string) => (input.includes('@') ? true : 'Must be a full email address'),
      },
      {
        type: 'password',
        name: 'password',
        message: theme.secondary('Email password:'),
        mask: '•',
      },
      {
        type: 'input',
        name: 'domain',
        message: theme.secondary('Primary domain:'),
        default: (answers: any) => (answers.username || '').split('@')[1] || getConfig().domain || '',
      },
    ]);

    setProfile('default', {
      server: answers.server,
      username: answers.username,
      password: answers.password,
      domain: answers.domain,
    });

    console.log(theme.success(`\n  ${theme.statusIcon('pass')} SMTP configuration saved\n`));
  }

  // Step 3: DirectAdmin Auth
  if (components.includes('auth')) {
    console.log(theme.heading('DirectAdmin API Authentication'));
    console.log(theme.muted('  Create a Login Key at Control Panel (panel.mxroute.com) -> Login Keys\n'));

    const config = getConfig();
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'server',
        message: theme.secondary('Server hostname:'),
        default: config.server || '',
        filter: (input: string) => input.replace('.mxrouting.net', '').replace(':2222', '').trim(),
      },
      {
        type: 'input',
        name: 'username',
        message: theme.secondary('DirectAdmin username:'),
        default: config.daUsername || '',
      },
      {
        type: 'password',
        name: 'loginKey',
        message: theme.secondary('Login Key:'),
        mask: '•',
      },
    ]);

    const spinner = ora({ text: 'Testing authentication...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const result = await testAuth({ server: answers.server, username: answers.username, loginKey: answers.loginKey });
      if (result.success) {
        spinner.succeed(chalk.green('Authentication successful'));
        setConfig('server', answers.server);
        setConfig('daUsername', answers.username);
        setConfig('daLoginKey', answers.loginKey);
      } else {
        spinner.fail(chalk.red(`Authentication failed: ${result.message}`));
        console.log(theme.muted('  You can retry later with: mxroute auth login\n'));
      }
    } catch (err: any) {
      spinner.fail(chalk.red(`Connection failed: ${err.message}`));
    }
    console.log('');
  }

  // Step 4: MCP Server
  if (components.includes('mcp')) {
    console.log(theme.heading('MCP Server Installation'));

    const mcpBin = getMcpBinPath();

    // Show detected + let user pick additional
    const mcpChoices = tools
      .filter((t) => t.mcpConfigPath) // only tools that support MCP config
      .map((t) => ({
        name: `${t.name}${t.detected ? chalk.green(' (detected)') : ''}`,
        value: t.id,
        checked: t.detected,
      }));

    mcpChoices.push({ name: 'Show config only (manual setup)', value: 'manual', checked: false });

    const { mcpTargets } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'mcpTargets',
        message: 'Install MCP server for:',
        choices: mcpChoices,
      },
    ]);

    if (mcpTargets.includes('manual') || mcpTargets.length === 0) {
      console.log('');
      console.log(theme.subheading('MCP Server Configuration'));
      console.log(theme.keyValue('Binary', mcpBin));
      console.log(theme.keyValue('Transport', 'stdio'));
      console.log('');
      console.log(theme.subheading('Add to your MCP config:'));
      console.log(theme.muted('    {'));
      console.log(theme.muted('      "mcpServers": {'));
      console.log(theme.muted('        "mxroute": {'));
      console.log(theme.muted(`          "command": "${mcpBin}"`));
      console.log(theme.muted('        }'));
      console.log(theme.muted('      }'));
      console.log(theme.muted('    }'));
    }

    console.log('');
    for (const targetId of mcpTargets) {
      if (targetId === 'manual') continue;
      const tool = tools.find((t) => t.id === targetId);
      if (tool) installMcp(tool, mcpBin);
    }
    console.log('');
  }

  // Step 5: Rules / Skills / Instructions
  if (components.includes('rules')) {
    console.log(theme.heading('AI Tool Instructions'));

    const rulesTools = tools.filter((t) => t.rulesPath && t.rulesFormat);
    const rulesChoices = rulesTools.map((t) => ({
      name: `${t.name}${t.detected ? chalk.green(' (detected)') : ''}`,
      value: t.id,
      checked: t.detected,
    }));

    if (rulesChoices.length > 0) {
      const { rulesTargets } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'rulesTargets',
          message: 'Install MXroute instructions for:',
          choices: rulesChoices,
        },
      ]);

      console.log('');
      for (const targetId of rulesTargets) {
        const tool = rulesTools.find((t) => t.id === targetId);
        if (tool) installRules(tool);
      }
    } else {
      console.log(theme.muted('  No supported AI tools detected for instructions.\n'));
    }
    console.log('');
  }

  // Summary
  console.log(theme.separator());
  console.log(theme.heading('Setup Complete'));
  console.log(theme.subheading('Next steps:'));
  console.log(theme.muted('    mxroute status              View your account dashboard'));
  console.log(theme.muted('    mxroute domains list        List your domains'));
  console.log(theme.muted('    mxroute dns check           Verify DNS records'));
  console.log(theme.muted('    mxroute --help              See all commands'));
  console.log('');
  console.log(theme.muted('  Restart any AI tools to pick up the new MCP server and instructions.'));
  console.log('');
}
