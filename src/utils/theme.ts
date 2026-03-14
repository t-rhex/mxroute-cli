import chalk from 'chalk';
import figures from 'figures';

export const theme = {
  primary: chalk.hex('#6C63FF'),
  secondary: chalk.hex('#00D9FF'),
  success: chalk.hex('#00E676'),
  warning: chalk.hex('#FFD600'),
  error: chalk.hex('#FF5252'),
  muted: chalk.hex('#7C8DB0'),
  info: chalk.hex('#448AFF'),
  bold: chalk.bold,
  dim: chalk.dim,

  heading(text: string): string {
    return '\n' + chalk.bold.hex('#6C63FF')(`  ${figures.pointer} ${text}`) + '\n';
  },

  subheading(text: string): string {
    return chalk.hex('#00D9FF')(`    ${text}`);
  },

  label(text: string): string {
    return chalk.hex('#7C8DB0')(text);
  },

  value(text: string): string {
    return chalk.white.bold(text);
  },

  record(type: string, name: string, value: string, priority?: number): string {
    const t = chalk.hex('#FFD600').bold(type.padEnd(6));
    const n = chalk.white(name.padEnd(20));
    const p = priority !== undefined ? chalk.hex('#7C8DB0')(`(pri: ${priority}) `.padEnd(12)) : '            ';
    const v = chalk.hex('#00E676')(value);
    return `    ${t} ${n} ${p} ${v}`;
  },

  banner(): string {
    const c = chalk.hex('#00D9FF');
    const m = chalk.hex('#7C8DB0');
    const p = chalk.hex('#6C63FF');
    const logo = [
      '',
      c('   __  ____  __                _       '),
      c('  |  \\/  \\ \\/ /_ __ ___  _   _| |_ ___ '),
      c("  | |\\/| |\\  /| '__/ _ \\| | | | __/ _ \\"),
      c('  | |  | |/  \\| | | (_) | |_| | ||  __/'),
      c('  |_|  |_/_/\\_\\_|  \\___/ \\__,_|\\__\\___|'),
      '',
      `  ${p('Email Hosting Management CLI')}`,
      '',
    ];
    return logo.join('\n');
  },

  separator(): string {
    return chalk.hex('#7C8DB0')('  ' + '─'.repeat(42));
  },

  keyValue(key: string, val: string, indent = 4): string {
    const pad = ' '.repeat(indent);
    return `${pad}${chalk.hex('#7C8DB0')(key.padEnd(18))} ${chalk.white(val)}`;
  },

  statusIcon(status: 'pass' | 'fail' | 'warn' | 'info'): string {
    switch (status) {
      case 'pass':
        return chalk.hex('#00E676')(figures.tick);
      case 'fail':
        return chalk.hex('#FF5252')(figures.cross);
      case 'warn':
        return chalk.hex('#FFD600')(figures.warning);
      case 'info':
        return chalk.hex('#448AFF')(figures.info);
    }
  },

  box(content: string, title?: string): string {
    const lines = content.split('\n');
    const maxLen = Math.max(...lines.map((l) => stripAnsi(l).length), title ? stripAnsi(title).length + 4 : 0);
    const width = maxLen + 4;
    const top = title
      ? chalk.hex('#6C63FF')('  ┌─ ') +
        chalk.hex('#00D9FF').bold(title) +
        chalk.hex('#6C63FF')(' ' + '─'.repeat(Math.max(0, width - stripAnsi(title).length - 5)) + '┐')
      : chalk.hex('#6C63FF')('  ┌' + '─'.repeat(width) + '┐');
    const bottom = chalk.hex('#6C63FF')('  └' + '─'.repeat(width) + '┘');
    const body = lines.map((l) => {
      const pad = ' '.repeat(Math.max(0, maxLen - stripAnsi(l).length));
      return chalk.hex('#6C63FF')('  │') + '  ' + l + pad + '  ' + chalk.hex('#6C63FF')('│');
    });
    return [top, ...body, bottom].join('\n');
  },
};

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export { stripAnsi };
