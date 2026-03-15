import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { listDomains, listDomainPointers } from '../utils/directadmin';
import { getCreds, tableChars } from '../utils/shared';
import { isJsonMode, output } from '../utils/json-output';

export async function domainsList(): Promise<void> {
  const creds = getCreds();

  if (!isJsonMode()) console.log(theme.heading('Domains'));

  const spinner = isJsonMode() ? null : ora({ text: 'Fetching domains...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const domains = await listDomains(creds);
    spinner?.stop();

    if (isJsonMode()) {
      const domainsWithAliases = await Promise.all(
        domains.map(async (domain) => {
          let aliases: string[] = [];
          try {
            const pointers = await listDomainPointers(creds, domain);
            aliases = Object.keys(pointers).filter((k) => k !== 'error' && k !== 'text');
          } catch {
            aliases = [];
          }
          return { domain, aliases };
        }),
      );
      output('domains', domainsWithAliases);
      return;
    }

    if (domains.length === 0) {
      console.log(theme.muted('  No domains found.\n'));
      return;
    }

    const table = new Table({
      head: [chalk.hex('#6C63FF')('#'), chalk.hex('#6C63FF')('Domain'), chalk.hex('#6C63FF')('Aliases')],
      style: { head: [], border: ['gray'] },
      chars: tableChars,
    });

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      let aliases = '';
      try {
        const pointers = await listDomainPointers(creds, domain);
        const aliasList = Object.keys(pointers).filter((k) => k !== 'error' && k !== 'text');
        aliases = aliasList.length > 0 ? aliasList.join(', ') : chalk.gray('none');
      } catch {
        aliases = chalk.gray('—');
      }
      table.push([chalk.gray(`${i + 1}`), chalk.white.bold(domain), aliases]);
    }

    console.log(table.toString());
    console.log(theme.muted(`\n  ${domains.length} domain${domains.length !== 1 ? 's' : ''} found\n`));
  } catch (err: any) {
    spinner?.fail(chalk.red('Failed to fetch domains'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function domainsInfo(domain?: string): Promise<void> {
  const creds = getCreds();
  const config = getConfig();
  const targetDomain = domain || config.domain;

  if (!targetDomain) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} Specify a domain: ${theme.bold('mxroute domains info example.com')}\n`,
      ),
    );
    process.exit(1);
  }

  if (!isJsonMode()) console.log(theme.heading(`Domain: ${targetDomain}`));

  const spinner = isJsonMode()
    ? null
    : ora({ text: `Fetching info for ${targetDomain}...`, spinner: 'dots12', color: 'cyan' }).start();

  try {
    const [pointers] = await Promise.all([listDomainPointers(creds, targetDomain).catch(() => ({}))]);

    spinner?.stop();

    const aliasList = Object.keys(pointers).filter((k) => k !== 'error' && k !== 'text');

    if (isJsonMode()) {
      output('domain', targetDomain);
      output('server', `${creds.server}.mxrouting.net`);
      output('aliases', aliasList);
      return;
    }

    console.log(theme.keyValue('Domain', targetDomain));
    console.log(theme.keyValue('Server', `${creds.server}.mxrouting.net`));

    if (aliasList.length > 0) {
      console.log(theme.keyValue('Aliases', aliasList.join(', ')));
    } else {
      console.log(theme.keyValue('Aliases', chalk.gray('none')));
    }

    console.log('');
    console.log(theme.subheading('Quick Actions'));
    console.log(theme.muted(`    mxroute accounts list ${targetDomain}     List email accounts`));
    console.log(theme.muted(`    mxroute forwarders list ${targetDomain}    List forwarders`));
    console.log(theme.muted(`    mxroute dns check ${targetDomain}          Check DNS records`));
    console.log('');
  } catch (err: any) {
    spinner?.fail(chalk.red('Failed to fetch domain info'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}
