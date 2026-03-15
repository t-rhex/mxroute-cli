export interface CategoryInfo {
  name: string;
  description: string;
  commands: string[];
}

export interface CommandInfo {
  description: string;
  examples: string[];
  related: string[];
}

export const categories: Record<string, CategoryInfo> = {
  'getting-started': {
    name: 'Getting Started',
    description: 'Initial setup, authentication, and account configuration',
    commands: ['setup', 'config', 'auth', 'status', 'whoami'],
  },
  'email-management': {
    name: 'Email Management',
    description: 'Manage email accounts, forwarders, autoresponders, filters, and mailing lists',
    commands: ['accounts', 'forwarders', 'autoresponder', 'catchall', 'filters', 'lists', 'aliases'],
  },
  'mail-client': {
    name: 'Mail Client',
    description: 'Read, compose, reply, forward, and manage email messages and folders',
    commands: ['mail'],
  },
  'dns-deliverability': {
    name: 'DNS & Deliverability',
    description: 'Check and manage DNS records, IP reputation, and email deliverability',
    commands: ['dns', 'dnsrecords', 'ip', 'reputation', 'ssl-check'],
  },
  'email-sending': {
    name: 'Email Sending',
    description: 'Send emails, run delivery tests, manage webhooks and templates',
    commands: ['send', 'test', 'webhook', 'templates'],
  },
  'spam-security': {
    name: 'Spam & Security',
    description: 'Configure spam filters, run security audits, and manage password policies',
    commands: ['spam', 'audit', 'password-audit', 'cleanup'],
  },
  'monitoring-ops': {
    name: 'Monitoring & Ops',
    description: 'Monitor mail services, run diagnostics, benchmarks, and scheduled tasks',
    commands: ['monitor', 'doctor', 'benchmark', 'cron', 'rate-limit'],
  },
  'data-migration': {
    name: 'Data & Migration',
    description: 'Export, import, diff, bulk-operate, migrate, backup, and review usage history',
    commands: ['export', 'import', 'diff', 'bulk', 'migrate', 'backup', 'usage-history'],
  },
  business: {
    name: 'Business',
    description: 'Onboard clients, manage provisioning, quotas, credentials, and welcome flows',
    commands: ['onboard', 'provision', 'deprovision', 'welcome-send', 'credentials-export', 'quota', 'quota-policy'],
  },
  platform: {
    name: 'Platform',
    description: 'AI-powered guides, suggestions, playbooks, dashboards, shell completions, and integrations',
    commands: [
      'guide',
      'suggest',
      'playbook',
      'dashboard',
      'completions',
      'open',
      'share',
      'report',
      'fix',
      'schedule',
      'notify',
    ],
  },
};

export const commandExamples: Record<string, CommandInfo> = {
  // Getting Started
  setup: {
    description: 'Interactive wizard to configure your MXroute API credentials and preferences',
    examples: ['mxroute setup', 'mxroute setup --api-key YOUR_KEY --server mail.example.com', 'mxroute setup --json'],
    related: ['config', 'auth', 'status'],
  },
  config: {
    description: 'View or update CLI configuration settings',
    examples: ['mxroute config', 'mxroute config set server mail.example.com', 'mxroute config --json'],
    related: ['setup', 'auth', 'whoami'],
  },
  auth: {
    description: 'Authenticate and validate your MXroute API credentials',
    examples: ['mxroute auth', 'mxroute auth --api-key YOUR_KEY', 'mxroute auth --json'],
    related: ['setup', 'config', 'whoami'],
  },
  status: {
    description: 'Show current connection status and service health',
    examples: ['mxroute status', 'mxroute status --json', 'mxroute status --verbose'],
    related: ['doctor', 'monitor', 'auth'],
  },
  whoami: {
    description: 'Display the currently authenticated account and server details',
    examples: ['mxroute whoami', 'mxroute whoami --json'],
    related: ['auth', 'config', 'status'],
  },

  // Email Management
  'accounts list': {
    description: 'List all email accounts for a domain',
    examples: [
      'mxroute accounts list',
      'mxroute accounts list example.com',
      "mxroute accounts list --json | jq '.data.accounts[]'",
    ],
    related: ['accounts create', 'accounts delete', 'forwarders list'],
  },
  'accounts create': {
    description: 'Create a new email account on a domain',
    examples: [
      'mxroute accounts create user@example.com --password secret',
      'mxroute accounts create user@example.com --quota 1024',
      'mxroute accounts create user@example.com --json',
    ],
    related: ['accounts list', 'accounts delete', 'quota'],
  },
  'accounts delete': {
    description: 'Delete an email account',
    examples: [
      'mxroute accounts delete user@example.com',
      'mxroute accounts delete user@example.com --confirm',
      'mxroute accounts delete user@example.com --json',
    ],
    related: ['accounts list', 'accounts create', 'deprovision'],
  },
  'forwarders list': {
    description: 'List all email forwarders for a domain',
    examples: ['mxroute forwarders list', 'mxroute forwarders list example.com', 'mxroute forwarders list --json'],
    related: ['forwarders create', 'forwarders delete', 'accounts list'],
  },
  'forwarders create': {
    description: 'Create an email forwarder from one address to another',
    examples: [
      'mxroute forwarders create info@example.com admin@example.com',
      'mxroute forwarders create --from info@example.com --to admin@example.com',
      'mxroute forwarders create info@example.com admin@example.com --json',
    ],
    related: ['forwarders list', 'forwarders delete', 'catchall'],
  },
  catchall: {
    description: 'Get or set the catch-all email address for a domain',
    examples: [
      'mxroute catchall example.com',
      'mxroute catchall example.com --set admin@example.com',
      'mxroute catchall --json',
    ],
    related: ['forwarders list', 'accounts list', 'filters'],
  },
  autoresponder: {
    description: 'Manage autoresponders (out-of-office replies) for email accounts',
    examples: [
      'mxroute autoresponder list user@example.com',
      'mxroute autoresponder create user@example.com --message "I am away"',
      'mxroute autoresponder delete user@example.com',
    ],
    related: ['accounts list', 'filters', 'templates'],
  },
  filters: {
    description: 'Manage email filters for accounts',
    examples: [
      'mxroute filters list user@example.com',
      'mxroute filters create user@example.com --rule "subject contains SPAM" --action delete',
      'mxroute filters delete user@example.com --id FILTER_ID',
    ],
    related: ['spam', 'accounts list', 'autoresponder'],
  },
  lists: {
    description: 'Manage mailing lists for a domain',
    examples: [
      'mxroute lists list example.com',
      'mxroute lists create newsletter@example.com',
      'mxroute lists members newsletter@example.com',
    ],
    related: ['aliases', 'forwarders list', 'accounts list'],
  },
  aliases: {
    description: 'Manage domain aliases that point to a primary domain',
    examples: [
      'mxroute aliases list',
      'mxroute aliases add alias.com --primary example.com',
      'mxroute aliases remove alias.com',
    ],
    related: ['lists', 'forwarders list', 'dns check'],
  },

  // Mail Client
  'mail inbox': {
    description: 'View your email inbox',
    examples: [
      'mxroute mail inbox',
      'mxroute mail inbox --account user@example.com',
      "mxroute mail inbox --json | jq '.data.messages[]'",
    ],
    related: ['mail read', 'mail compose', 'mail search'],
  },
  'mail read': {
    description: 'Read a specific email message',
    examples: [
      'mxroute mail read MESSAGE_ID',
      'mxroute mail read MESSAGE_ID --account user@example.com',
      'mxroute mail read MESSAGE_ID --json',
    ],
    related: ['mail inbox', 'mail reply', 'mail forward'],
  },
  'mail compose': {
    description: 'Compose and send a new email message',
    examples: [
      'mxroute mail compose --to recipient@example.com --subject "Hello"',
      'mxroute mail compose --to recipient@example.com --body "Message body"',
      'mxroute mail compose --template welcome --to user@example.com',
    ],
    related: ['mail reply', 'send', 'templates'],
  },
  'mail reply': {
    description: 'Reply to an email message',
    examples: [
      'mxroute mail reply MESSAGE_ID --body "Reply text"',
      'mxroute mail reply MESSAGE_ID --all',
      'mxroute mail reply MESSAGE_ID --json',
    ],
    related: ['mail read', 'mail forward', 'mail compose'],
  },
  'mail forward': {
    description: 'Forward an email message to another address',
    examples: [
      'mxroute mail forward MESSAGE_ID --to other@example.com',
      'mxroute mail forward MESSAGE_ID --to other@example.com --note "FYI"',
      'mxroute mail forward MESSAGE_ID --json',
    ],
    related: ['mail reply', 'mail read', 'forwarders create'],
  },
  'mail search': {
    description: 'Search emails by keyword, sender, subject, or date range',
    examples: [
      'mxroute mail search "invoice"',
      'mxroute mail search --from sender@example.com --since 2024-01-01',
      'mxroute mail search "urgent" --json',
    ],
    related: ['mail inbox', 'mail read', 'bulk'],
  },
  'mail folders': {
    description: 'List and manage mail folders',
    examples: [
      'mxroute mail folders list',
      'mxroute mail folders create "Archive"',
      'mxroute mail folders delete "Old"',
    ],
    related: ['mail inbox', 'mail search', 'bulk'],
  },

  // DNS & Deliverability
  'dns check': {
    description: 'Verify MX, SPF, DKIM, and DMARC records for a domain',
    examples: [
      'mxroute dns check example.com',
      'mxroute dns check example.com --json',
      "mxroute dns check --json | jq '.data.checks[]'",
    ],
    related: ['dns setup', 'dns watch', 'audit', 'fix'],
  },
  'dns setup': {
    description: 'Generate recommended DNS records for a domain',
    examples: [
      'mxroute dns setup example.com',
      'mxroute dns setup example.com --registrar cloudflare',
      'mxroute dns setup example.com --json',
    ],
    related: ['dns check', 'dnsrecords', 'fix'],
  },
  'dns watch': {
    description: 'Continuously monitor DNS propagation for a domain',
    examples: [
      'mxroute dns watch example.com',
      'mxroute dns watch example.com --interval 60',
      'mxroute dns watch example.com --json',
    ],
    related: ['dns check', 'monitor', 'status'],
  },
  dnsrecords: {
    description: 'List, add, or delete raw DNS records for a domain',
    examples: [
      'mxroute dnsrecords list example.com',
      'mxroute dnsrecords add example.com --type TXT --name "@" --value "v=spf1..."',
      'mxroute dnsrecords delete example.com --id RECORD_ID',
    ],
    related: ['dns check', 'dns setup', 'fix'],
  },
  reputation: {
    description: 'Check IP and domain reputation across major blacklists',
    examples: ['mxroute reputation example.com', 'mxroute reputation 1.2.3.4', 'mxroute reputation example.com --json'],
    related: ['dns check', 'audit', 'blacklist'],
  },
  'ssl-check': {
    description: 'Verify SSL/TLS certificate validity for mail server hostnames',
    examples: [
      'mxroute ssl-check mail.example.com',
      'mxroute ssl-check --json',
      "mxroute ssl-check mail.example.com --json | jq '.data.expiry'",
    ],
    related: ['dns check', 'status', 'doctor'],
  },

  // Email Sending
  send: {
    description: 'Send an email directly via SMTP or the MXroute API',
    examples: [
      'mxroute send --to recipient@example.com --subject "Hello" --body "World"',
      'mxroute send --from user@example.com --to recipient@example.com --template welcome',
      'mxroute send --json',
    ],
    related: ['mail compose', 'templates', 'test'],
  },
  test: {
    description: 'Test email delivery and SMTP connectivity',
    examples: [
      'mxroute test delivery example.com',
      'mxroute test smtp mail.example.com',
      'mxroute test delivery example.com --json',
    ],
    related: ['send', 'dns check', 'doctor'],
  },
  webhook: {
    description: 'Manage webhooks for email events',
    examples: [
      'mxroute webhook list',
      'mxroute webhook create --url https://example.com/hook --event bounce',
      'mxroute webhook delete WEBHOOK_ID',
    ],
    related: ['send', 'monitor', 'notify'],
  },
  templates: {
    description: 'Manage reusable email templates',
    examples: [
      'mxroute templates list',
      'mxroute templates create welcome --subject "Welcome!" --file welcome.html',
      'mxroute templates delete TEMPLATE_ID',
    ],
    related: ['send', 'mail compose', 'welcome-send'],
  },

  // Spam & Security
  spam: {
    description: 'View and configure spam filter settings for accounts',
    examples: [
      'mxroute spam config user@example.com',
      'mxroute spam set user@example.com --level 5',
      'mxroute spam --json',
    ],
    related: ['filters', 'audit', 'cleanup'],
  },
  audit: {
    description: 'Run a comprehensive security audit of your email configuration',
    examples: ['mxroute audit', 'mxroute audit example.com', "mxroute audit --json | jq '.data.issues[]'"],
    related: ['dns check', 'spam', 'password-audit', 'fix'],
  },
  'password-audit': {
    description: 'Audit email account passwords for strength and security compliance',
    examples: ['mxroute password-audit', 'mxroute password-audit example.com', 'mxroute password-audit --json'],
    related: ['audit', 'accounts list', 'security'],
  },
  cleanup: {
    description: 'Identify and remove orphaned accounts, stale forwarders, and unused resources',
    examples: ['mxroute cleanup', 'mxroute cleanup --dry-run', 'mxroute cleanup --json'],
    related: ['audit', 'bulk', 'export'],
  },

  // Monitoring & Ops
  monitor: {
    description: 'Start real-time monitoring of mail queues and delivery metrics',
    examples: ['mxroute monitor', 'mxroute monitor --interval 30', 'mxroute monitor --json'],
    related: ['status', 'doctor', 'benchmark'],
  },
  doctor: {
    description: 'Run automated diagnostics to detect and suggest fixes for configuration issues',
    examples: ['mxroute doctor', 'mxroute doctor example.com', 'mxroute doctor --json'],
    related: ['status', 'audit', 'fix', 'monitor'],
  },
  benchmark: {
    description: 'Benchmark SMTP send performance and measure server response times',
    examples: ['mxroute benchmark', 'mxroute benchmark --count 100', 'mxroute benchmark --json'],
    related: ['test', 'monitor', 'doctor'],
  },
  cron: {
    description: 'Schedule recurring CLI tasks using cron syntax',
    examples: [
      'mxroute cron list',
      'mxroute cron add "0 * * * *" "mxroute dns check example.com"',
      'mxroute cron delete CRON_ID',
    ],
    related: ['schedule', 'monitor', 'notify'],
  },
  'rate-limit': {
    description: 'Check current API rate limit usage and remaining quota',
    examples: ['mxroute rate-limit', 'mxroute rate-limit --json', "mxroute rate-limit --json | jq '.data.remaining'"],
    related: ['status', 'monitor', 'quota'],
  },

  // Data & Migration
  export: {
    description: 'Export accounts, forwarders, DNS records, or settings to a file',
    examples: [
      'mxroute export accounts --output accounts.json',
      'mxroute export forwarders example.com --output forwarders.csv',
      'mxroute export --all --output backup.json',
    ],
    related: ['import', 'backup', 'migrate'],
  },
  import: {
    description: 'Import accounts, forwarders, or DNS records from a file',
    examples: [
      'mxroute import accounts --file accounts.json',
      'mxroute import forwarders --file forwarders.csv',
      'mxroute import --dry-run --file backup.json',
    ],
    related: ['export', 'migrate', 'provision'],
  },
  diff: {
    description: 'Compare current configuration against a saved snapshot or another domain',
    examples: [
      'mxroute diff example.com --snapshot snapshot.json',
      'mxroute diff example.com other.com',
      'mxroute diff --json',
    ],
    related: ['export', 'audit', 'migrate'],
  },
  bulk: {
    description: 'Perform bulk operations on accounts, messages, or forwarders',
    examples: [
      'mxroute bulk delete --accounts --filter "domain:old.com"',
      'mxroute bulk move --messages --from inbox --to Archive',
      'mxroute bulk --json',
    ],
    related: ['cleanup', 'export', 'migrate'],
  },
  migrate: {
    description: 'Migrate email accounts and settings from one server or domain to another',
    examples: [
      'mxroute migrate --from old.com --to new.com',
      'mxroute migrate --dry-run --from old.com --to new.com',
      'mxroute migrate --json',
    ],
    related: ['export', 'import', 'provision'],
  },
  'usage-history': {
    description: 'View historical usage data including storage, bandwidth, and message counts',
    examples: [
      'mxroute usage-history',
      'mxroute usage-history --from 2024-01-01 --to 2024-12-31',
      'mxroute usage-history --json',
    ],
    related: ['quota', 'monitor', 'report'],
  },

  // Business
  onboard: {
    description: 'Guided onboarding flow for setting up a new client domain end-to-end',
    examples: ['mxroute onboard example.com', 'mxroute onboard example.com --plan business', 'mxroute onboard --json'],
    related: ['provision', 'welcome-send', 'dns setup'],
  },
  provision: {
    description: 'Automatically provision a new domain with accounts, DNS, and defaults',
    examples: [
      'mxroute provision example.com',
      'mxroute provision example.com --plan --execute',
      'mxroute provision --json',
    ],
    related: ['deprovision', 'onboard', 'import'],
  },
  deprovision: {
    description: 'Remove all resources for a domain and revoke access',
    examples: [
      'mxroute deprovision example.com',
      'mxroute deprovision example.com --confirm',
      'mxroute deprovision example.com --json',
    ],
    related: ['provision', 'cleanup', 'bulk'],
  },
  'welcome-send': {
    description: 'Send a welcome email to newly created accounts',
    examples: [
      'mxroute welcome-send user@example.com',
      'mxroute welcome-send --domain example.com --all',
      'mxroute welcome-send --json',
    ],
    related: ['templates', 'send', 'onboard'],
  },
  'credentials-export': {
    description: 'Securely export account credentials for client handoff',
    examples: [
      'mxroute credentials-export example.com',
      'mxroute credentials-export example.com --format csv --output creds.csv',
      'mxroute credentials-export --json',
    ],
    related: ['export', 'onboard', 'provision'],
  },
  quota: {
    description: 'View or set storage quotas for email accounts',
    examples: [
      'mxroute quota user@example.com',
      'mxroute quota set user@example.com --limit 2048',
      'mxroute quota --json',
    ],
    related: ['quota-policy', 'accounts list', 'usage-history'],
  },
  'quota-policy': {
    description: 'Define and apply quota policies across domains or account groups',
    examples: [
      'mxroute quota-policy list',
      'mxroute quota-policy apply example.com --policy standard',
      'mxroute quota-policy --json',
    ],
    related: ['quota', 'provision', 'accounts list'],
  },

  // Platform
  guide: {
    description: 'Access AI-powered guides and documentation for common tasks',
    examples: ['mxroute guide "how to set up SPF"', 'mxroute guide --category dns', 'mxroute guide --json'],
    related: ['suggest', 'playbook', 'fix'],
  },
  suggest: {
    description: 'Get AI-driven command suggestions based on your current context',
    examples: ['mxroute suggest', 'mxroute suggest --context "dns issues"', 'mxroute suggest --json'],
    related: ['guide', 'fix', 'playbook'],
  },
  playbook: {
    description: 'Run a predefined step-by-step operational playbook',
    examples: ['mxroute playbook list', 'mxroute playbook run new-client-setup', 'mxroute playbook --json'],
    related: ['guide', 'onboard', 'provision'],
  },
  dashboard: {
    description: 'Open an interactive terminal dashboard with key metrics and alerts',
    examples: ['mxroute dashboard', 'mxroute dashboard --refresh 30', 'mxroute dashboard --json'],
    related: ['monitor', 'status', 'report'],
  },
  completions: {
    description: 'Generate shell completion scripts for bash, zsh, or fish',
    examples: [
      'mxroute completions bash',
      'mxroute completions zsh > ~/.zsh/completions/_mxroute',
      'mxroute completions fish',
    ],
    related: ['guide', 'config'],
  },
  fix: {
    description: 'Automatically apply fixes for detected configuration issues',
    examples: ['mxroute fix example.com', 'mxroute fix example.com --dry-run', 'mxroute fix --json'],
    related: ['doctor', 'audit', 'dns setup'],
  },
  report: {
    description: 'Generate a summary report of account health, usage, and deliverability',
    examples: ['mxroute report', 'mxroute report example.com --format pdf', 'mxroute report --json'],
    related: ['audit', 'usage-history', 'dashboard'],
  },
  notify: {
    description: 'Configure notifications for email events, alerts, and threshold breaches',
    examples: [
      'mxroute notify list',
      'mxroute notify add --event bounce --channel slack --url https://hooks.slack.com/...',
      'mxroute notify --json',
    ],
    related: ['webhook', 'monitor', 'cron'],
  },
};

export function findCategory(query: string): CategoryInfo | null {
  const q = query.toLowerCase().trim();

  // Exact match on category name
  for (const cat of Object.values(categories)) {
    if (cat.name.toLowerCase() === q) {
      return cat;
    }
  }

  // Fuzzy: query appears in name or description
  for (const cat of Object.values(categories)) {
    if (cat.name.toLowerCase().includes(q) || cat.description.toLowerCase().includes(q)) {
      return cat;
    }
  }

  // Fuzzy: query matches any command in the category
  for (const cat of Object.values(categories)) {
    if (cat.commands.some((cmd) => cmd.toLowerCase().includes(q))) {
      return cat;
    }
  }

  return null;
}

export function findCommand(query: string): CommandInfo | null {
  const q = query.toLowerCase().trim();

  // Direct lookup
  if (commandExamples[q]) {
    return commandExamples[q];
  }

  // Try replacing hyphens/underscores with spaces (e.g. "dns-check" → "dns check")
  const withSpaces = q.replace(/[-_]/g, ' ');
  if (commandExamples[withSpaces]) {
    return commandExamples[withSpaces];
  }

  // Try replacing spaces with hyphens
  const withHyphens = q.replace(/\s+/g, '-');
  if (commandExamples[withHyphens]) {
    return commandExamples[withHyphens];
  }

  return null;
}

export function getAllCommands(): string[] {
  const all: string[] = [];
  for (const cat of Object.values(categories)) {
    for (const cmd of cat.commands) {
      if (!all.includes(cmd)) {
        all.push(cmd);
      }
    }
  }
  return all;
}
