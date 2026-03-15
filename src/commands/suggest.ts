import { theme } from '../utils/theme';

interface Mapping {
  keywords: string[];
  command: string;
  extract: string[];
}

const mappings: Mapping[] = [
  // Domains
  { keywords: ['list', 'show', 'domains', 'all domains'], command: 'domains list', extract: [] },
  { keywords: ['domain', 'info', 'details'], command: 'domains info', extract: ['domain'] },
  // Accounts
  { keywords: ['list', 'accounts', 'email accounts', 'users'], command: 'accounts list', extract: ['domain'] },
  { keywords: ['create', 'add', 'new', 'account'], command: 'accounts create', extract: ['domain'] },
  { keywords: ['delete', 'remove', 'account'], command: 'accounts delete', extract: ['domain'] },
  { keywords: ['password', 'change', 'passwd', 'reset'], command: 'accounts passwd', extract: ['domain'] },
  // Forwarders
  { keywords: ['forwarder', 'forward', 'redirect', 'list'], command: 'forwarders list', extract: ['domain'] },
  { keywords: ['create', 'add', 'forwarder', 'forward'], command: 'forwarders create', extract: ['domain'] },
  // DNS
  {
    keywords: ['check', 'dns', 'verify', 'health', 'spf', 'dkim', 'dmarc', 'mx'],
    command: 'dns check',
    extract: ['domain'],
  },
  { keywords: ['dns', 'records', 'required'], command: 'dns records', extract: ['domain'] },
  { keywords: ['dns', 'setup', 'configure', 'auto'], command: 'dns setup', extract: ['domain'] },
  { keywords: ['dns', 'watch', 'propagation', 'wait'], command: 'dns watch', extract: ['domain'] },
  { keywords: ['dkim', 'key', 'retrieve', 'get'], command: 'dnsrecords dkim', extract: ['domain'] },
  // Security
  { keywords: ['blacklist', 'ip', 'listed', 'blocked'], command: 'ip', extract: [] },
  { keywords: ['audit', 'security', 'scan', 'score'], command: 'audit', extract: [] },
  { keywords: ['spam', 'spamassassin', 'filter', 'status'], command: 'spam status', extract: ['domain'] },
  { keywords: ['reputation', 'sender', 'score'], command: 'reputation', extract: ['domain'] },
  { keywords: ['ssl', 'certificate', 'cert', 'expiry'], command: 'ssl-check', extract: [] },
  // Sending
  { keywords: ['send', 'email', 'compose', 'mail'], command: 'send', extract: ['to'] },
  { keywords: ['test', 'send', 'myself', 'test email'], command: 'test', extract: [] },
  { keywords: ['webhook', 'http', 'server', 'relay'], command: 'webhook', extract: [] },
  // Monitoring
  { keywords: ['monitor', 'health', 'check', 'ports'], command: 'monitor', extract: [] },
  { keywords: ['doctor', 'healthcheck', 'all', 'comprehensive'], command: 'doctor', extract: [] },
  { keywords: ['benchmark', 'speed', 'latency', 'performance'], command: 'benchmark', extract: [] },
  { keywords: ['cron', 'schedule', 'monitor', 'automatic'], command: 'cron setup', extract: [] },
  // Data
  { keywords: ['export', 'backup', 'save', 'dump'], command: 'export', extract: ['domain'] },
  { keywords: ['import', 'restore', 'load'], command: 'import', extract: [] },
  { keywords: ['migrate', 'migration', 'move', 'transfer', 'imapsync'], command: 'migrate', extract: [] },
  { keywords: ['quota', 'usage', 'disk', 'storage', 'space'], command: 'quota show', extract: [] },
  // Management
  {
    keywords: ['autoresponder', 'vacation', 'out of office', 'auto reply'],
    command: 'autoresponder list',
    extract: ['domain'],
  },
  { keywords: ['catchall', 'catch all', 'default', 'wildcard'], command: 'catchall get', extract: ['domain'] },
  { keywords: ['filter', 'rule', 'sorting'], command: 'filters list', extract: ['domain'] },
  { keywords: ['mailing', 'list', 'group', 'distribution'], command: 'lists list', extract: ['domain'] },
  { keywords: ['alias', 'pointer', 'domain alias'], command: 'aliases list', extract: ['domain'] },
  // Troubleshooting
  { keywords: ['troubleshoot', 'help', 'problem', 'issue', 'fix', 'debug'], command: 'troubleshoot', extract: [] },
  { keywords: ['header', 'analyze', 'trace', 'routing'], command: 'header-analyze', extract: [] },
  // Platform
  { keywords: ['setup', 'configure', 'install', 'get started'], command: 'setup', extract: [] },
  { keywords: ['status', 'dashboard', 'overview'], command: 'status', extract: [] },
  { keywords: ['onboard', 'new domain', 'add domain'], command: 'onboard', extract: ['domain'] },
  { keywords: ['report', 'infrastructure', 'pdf', 'summary'], command: 'report', extract: [] },
  { keywords: ['open', 'panel', 'webmail', 'browser'], command: 'open', extract: [] },
  { keywords: ['fix', 'auto fix', 'repair', 'auto-fix'], command: 'fix', extract: [] },
  { keywords: ['share', 'setup instructions', 'onboard user'], command: 'share', extract: ['email'] },
  // Mail
  { keywords: ['inbox', 'read', 'mail', 'messages', 'unread'], command: 'mail inbox', extract: [] },
  { keywords: ['compose', 'write', 'new email', 'draft'], command: 'mail compose', extract: [] },
  { keywords: ['search', 'find', 'mail', 'message'], command: 'mail search', extract: [] },
];

export function suggestCommand(prompt: string): void {
  const words = prompt
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const scored = mappings
    .map((m) => {
      const matches = m.keywords.filter((k) => {
        const kWords = k.split(' ');
        return kWords.some((kw) => words.some((w) => w.includes(kw) || kw.includes(w)));
      });
      return { ...m, score: matches.length / m.keywords.length };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || scored[0].score < 0.2) {
    console.log(theme.muted(`\n  Could not match "${prompt}".`));
    console.log(theme.muted(`  Try: ${theme.bold('mxroute guide')} to explore commands\n`));
    return;
  }

  const top = scored[0];

  if (top.score > 0.4) {
    const args = extractArgs(words, top.extract);
    const fullCommand = `mxroute ${top.command}${args ? ' ' + args : ''}`;
    console.log(theme.heading('Suggested Command'));
    console.log(`  ${theme.secondary('→')} ${theme.bold(fullCommand)}\n`);
  } else {
    console.log(theme.heading('Possible Commands'));
    for (const s of scored.slice(0, 3)) {
      const pct = Math.round(s.score * 100);
      console.log(`  ${theme.muted(`${pct}%`.padEnd(5))} ${theme.bold(`mxroute ${s.command}`)}`);
    }
    console.log('');
  }
}

function extractArgs(words: string[], extract: string[]): string {
  if (extract.includes('domain')) {
    const domainPattern = /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/;
    const domain = words.find((w) => domainPattern.test(w));
    if (domain) return domain;
  }
  if (extract.includes('email')) {
    const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/;
    const email = words.find((w) => emailPattern.test(w));
    if (email) return email;
  }
  return '';
}
