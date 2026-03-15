import chalk from 'chalk';
import ora from 'ora';
import { theme } from '../utils/theme';
import { listDomains, listEmailAccounts } from '../utils/directadmin';
import { getCreds } from '../utils/shared';

export async function accountsSearch(query?: string): Promise<void> {
  const creds = getCreds();

  if (!query) {
    console.log(
      theme.error(`\n  ${theme.statusIcon('fail')} Search query required. Usage: mxroute accounts search <query>\n`),
    );
    process.exit(1);
  }

  console.log(theme.heading(`Search Accounts: "${query}"`));

  const spinner = ora({ text: 'Searching across all domains...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const domains = await listDomains(creds);
    const results: { email: string; domain: string; user: string }[] = [];
    const searchLower = query.toLowerCase();

    for (const domain of domains) {
      try {
        const accounts = await listEmailAccounts(creds, domain);
        for (const user of accounts) {
          const email = `${user}@${domain}`;
          if (email.toLowerCase().includes(searchLower) || user.toLowerCase().includes(searchLower)) {
            results.push({ email, domain, user });
          }
        }
      } catch {
        // Skip domains we can't access
      }
    }

    spinner.stop();

    if (results.length === 0) {
      console.log(theme.muted(`  No accounts matching "${query}" found across ${domains.length} domains.\n`));
      return;
    }

    console.log(
      theme.muted(
        `  Found ${results.length} match${results.length === 1 ? '' : 'es'} across ${domains.length} domains:\n`,
      ),
    );

    // Group by domain
    const grouped: Record<string, string[]> = {};
    for (const r of results) {
      if (!grouped[r.domain]) grouped[r.domain] = [];
      grouped[r.domain].push(r.user);
    }

    for (const [domain, users] of Object.entries(grouped)) {
      console.log(theme.subheading(domain));
      for (const user of users) {
        const email = `${user}@${domain}`;
        const highlighted = email.replace(
          new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
          chalk.yellow.bold('$1'),
        );
        console.log(`      ${theme.statusIcon('info')} ${highlighted}`);
      }
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Search failed'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}
