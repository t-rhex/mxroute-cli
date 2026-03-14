import { theme } from '../utils/theme';

const COMMANDS = [
  'setup',
  'status',
  'config',
  'send',
  'dns',
  'info',
  'auth',
  'domains',
  'accounts',
  'forwarders',
  'autoresponder',
  'catchall',
  'spam',
  'dnsrecords',
  'filters',
  'lists',
  'aliases',
  'quota',
  'whoami',
  'open',
  'doctor',
  'export',
  'import',
  'audit',
  'ip',
  'share',
  'monitor',
  'troubleshoot',
  'test',
  'webhook',
  'completions',
  'bulk',
  'diff',
  'benchmark',
];

const SUBCOMMANDS: Record<string, string[]> = {
  config: ['setup', 'smtp', 'remove-smtp', 'show', 'profiles', 'switch', 'delete'],
  dns: ['check', 'records', 'generate', 'setup', 'watch'],
  info: ['connections', 'webmail', 'caldav', 'api', 'limits', 'panels', 'all', 'client'],
  auth: ['login', 'status', 'logout'],
  domains: ['list', 'info'],
  accounts: ['list', 'create', 'delete', 'passwd'],
  forwarders: ['list', 'create', 'delete'],
  autoresponder: ['list', 'create', 'edit', 'delete'],
  catchall: ['get', 'set'],
  spam: ['status', 'enable', 'disable', 'config'],
  dnsrecords: ['list', 'add', 'delete', 'dkim'],
  filters: ['list', 'create', 'delete'],
  lists: ['list', 'create', 'delete', 'members', 'add-member', 'remove-member'],
  aliases: ['list', 'add', 'remove'],
  quota: ['show', 'set'],
  open: ['panel', 'management', 'webmail', 'crossbox', 'whitelist', 'mailtester'],
  bulk: ['accounts', 'forwarders'],
};

export function completionsCommand(shell?: string): void {
  if (!shell) {
    console.log(theme.heading('Shell Completions'));
    console.log(theme.muted('  Generate shell completion scripts.\n'));
    console.log(theme.subheading('Usage:'));
    console.log(theme.muted('    mxroute completions bash    >> ~/.bashrc'));
    console.log(theme.muted('    mxroute completions zsh     >> ~/.zshrc'));
    console.log(theme.muted('    mxroute completions fish    > ~/.config/fish/completions/mxroute.fish'));
    console.log('');
    return;
  }

  switch (shell.toLowerCase()) {
    case 'bash':
      console.log(generateBash());
      break;
    case 'zsh':
      console.log(generateZsh());
      break;
    case 'fish':
      console.log(generateFish());
      break;
    default:
      console.log(theme.error(`\n  Unknown shell: ${shell}. Supported: bash, zsh, fish\n`));
  }
}

function generateBash(): string {
  const cmds = COMMANDS.join(' ');
  const subcmds = Object.entries(SUBCOMMANDS)
    .map(([cmd, subs]) => `        ${cmd}) COMPREPLY=($(compgen -W "${subs.join(' ')}" -- "$cur")) ;;`)
    .join('\n');

  return `# mxroute bash completion
_mxroute() {
    local cur prev commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    commands="${cmds}"

    case "$prev" in
${subcmds}
        mxroute) COMPREPLY=($(compgen -W "$commands" -- "$cur")) ;;
        *) COMPREPLY=($(compgen -W "$commands" -- "$cur")) ;;
    esac
}
complete -F _mxroute mxroute`;
}

function generateZsh(): string {
  const subcmds = Object.entries(SUBCOMMANDS)
    .map(([cmd, subs]) => `    ${cmd}) _values 'subcommand' ${subs.map((s) => `'${s}'`).join(' ')} ;;`)
    .join('\n');

  return `# mxroute zsh completion
#compdef mxroute

_mxroute() {
  local -a commands
  commands=(${COMMANDS.map((c) => `'${c}'`).join(' ')})

  _arguments '1:command:compadd -a commands' '*::arg:->args'

  case $words[1] in
${subcmds}
  esac
}

_mxroute "$@"`;
}

function generateFish(): string {
  const lines = ['# mxroute fish completion'];
  for (const cmd of COMMANDS) {
    lines.push(`complete -c mxroute -n '__fish_use_subcommand' -a '${cmd}'`);
  }
  for (const [cmd, subs] of Object.entries(SUBCOMMANDS)) {
    for (const sub of subs) {
      lines.push(`complete -c mxroute -n '__fish_seen_subcommand_from ${cmd}' -a '${sub}'`);
    }
  }
  return lines.join('\n');
}
