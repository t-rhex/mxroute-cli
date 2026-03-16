import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { theme } from '../utils/theme';
import { listDnsRecords, addDnsRecord, deleteDnsRecord, getDkimKey } from '../utils/directadmin';
import { getCreds, pickDomain, tableChars } from '../utils/shared';
import { isJsonMode, output } from '../utils/json-output';
import { checkNameservers } from '../utils/dns';
import { getConfig } from '../utils/config';
import { getProvider, RegistrarConfig } from '../utils/registrars';

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
}

function parseRecords(raw: any): DnsRecord[] {
  const records: DnsRecord[] = [];

  if (!raw || typeof raw !== 'object') return records;

  if (Array.isArray(raw)) {
    for (const rec of raw) {
      if (rec && rec.type) {
        records.push({
          type: rec.type,
          name: rec.name || '@',
          value: rec.value || '',
          ttl: rec.ttl ? parseInt(String(rec.ttl), 10) : undefined,
          priority: rec.priority ? parseInt(String(rec.priority), 10) : undefined,
        });
      }
    }
    return records;
  }

  if (raw.records && Array.isArray(raw.records)) {
    return parseRecords(raw.records);
  }

  // Handle numbered entries
  for (const key of Object.keys(raw)) {
    if (key === 'error' || key === 'text') continue;

    const val = raw[key];

    if (/^\d+$/.test(key) && typeof val === 'string') {
      const parsed = parseRecordString(val);
      if (parsed) records.push(parsed);
      continue;
    }

    // Type-grouped arrays (e.g. A: [...], MX: [...])
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === 'object' && item.value !== undefined) {
          records.push({
            type: key.toUpperCase(),
            name: item.name || '@',
            value: item.value,
            ttl: item.ttl ? parseInt(String(item.ttl), 10) : undefined,
            priority: item.priority ? parseInt(String(item.priority), 10) : undefined,
          });
        }
      }
      continue;
    }

    // Structured sub-keys like a_records, mx_records
    const typeGroupMatch = key.match(/^([a-z]+)_records$/i);
    if (typeGroupMatch && Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === 'object') {
          records.push({
            type: typeGroupMatch[1].toUpperCase(),
            name: item.name || '@',
            value: item.value || '',
            ttl: item.ttl ? parseInt(String(item.ttl), 10) : undefined,
            priority: item.priority ? parseInt(String(item.priority), 10) : undefined,
          });
        }
      }
      continue;
    }

    if (typeof val === 'string') {
      const parsed = parseRecordString(`${key} ${val}`);
      if (parsed) records.push(parsed);
    }
  }

  return records;
}

function parseRecordString(str: string): DnsRecord | null {
  const typeMatch = str.match(/^(A|AAAA|CNAME|MX|TXT|SRV|NS|CAA|PTR|SOA)\s/i);
  if (!typeMatch) return null;

  const type = typeMatch[1].toUpperCase();
  const nameMatch = str.match(/name=([^\s]+)/);
  const valueMatch = str.match(/value=(.+?)(?:\s+(?:ttl|priority|name)=|$)/);
  const ttlMatch = str.match(/ttl=(\d+)/);
  const priMatch = str.match(/priority=(\d+)/);

  return {
    type,
    name: nameMatch ? nameMatch[1] : '@',
    value: valueMatch ? valueMatch[1].trim() : str.slice(typeMatch[0].length).trim(),
    ttl: ttlMatch ? parseInt(ttlMatch[1], 10) : undefined,
    priority: priMatch ? parseInt(priMatch[1], 10) : undefined,
  };
}

function truncateValue(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 3) + '...';
}

export async function dnsapiList(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  if (!isJsonMode()) console.log(theme.heading(`DNS Records: ${targetDomain}`));

  const spinner = isJsonMode()
    ? null
    : ora({
        text: `Fetching DNS records for ${targetDomain}...`,
        spinner: 'dots12',
        color: 'cyan',
      }).start();

  try {
    const raw = await listDnsRecords(creds, targetDomain);
    spinner?.stop();

    const records = parseRecords(raw);

    if (isJsonMode()) {
      output('domain', targetDomain);
      output('records', records);
      return;
    }

    if (records.length === 0) {
      console.log(theme.muted('  No DNS records found.\n'));
      return;
    }

    const table = new Table({
      head: [
        chalk.hex('#6C63FF')('#'),
        chalk.hex('#6C63FF')('Type'),
        chalk.hex('#6C63FF')('Name'),
        chalk.hex('#6C63FF')('Value'),
        chalk.hex('#6C63FF')('TTL'),
      ],
      style: { head: [], border: ['gray'] },
      chars: tableChars,
      colWidths: [6, 8, 24, 46, 8],
      wordWrap: true,
    });

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const typeColor =
        rec.type === 'MX'
          ? chalk.hex('#FFD600')
          : rec.type === 'TXT'
            ? chalk.hex('#00E676')
            : rec.type === 'CNAME'
              ? chalk.hex('#00D9FF')
              : rec.type === 'A' || rec.type === 'AAAA'
                ? chalk.hex('#448AFF')
                : chalk.white;

      table.push([
        chalk.gray(`${i + 1}`),
        typeColor(rec.type),
        chalk.white(rec.name),
        chalk.hex('#00E676')(truncateValue(rec.value, 42)),
        chalk.gray(rec.ttl !== undefined ? String(rec.ttl) : '\u2014'),
      ]);
    }

    console.log(table.toString());
    console.log(theme.muted(`\n  ${records.length} record${records.length !== 1 ? 's' : ''} found\n`));
  } catch (err: any) {
    spinner?.fail(chalk.red('Failed to fetch DNS records'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function dnsapiAdd(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);
  const config = getConfig();

  // Check if MXroute is the DNS authority
  const nsInfo = await checkNameservers(targetDomain, config.server);
  if (!nsInfo.isMxrouteAuthority) {
    console.log(theme.warning(`\n  ${theme.statusIcon('warn')} ${targetDomain} DNS is NOT managed by MXroute.`));
    console.log(theme.muted(`  Nameservers: ${nsInfo.nameservers.join(', ')}`));
    if (nsInfo.provider) {
      console.log(theme.muted(`  DNS provider detected: ${theme.bold(nsInfo.provider)}`));
    }
    console.log(theme.warning(`\n  Adding records to DirectAdmin will have NO effect.`));

    // Try to use registrar API instead
    const registrar = (config as any).registrar;
    if (registrar && nsInfo.provider && registrar.provider === nsInfo.provider) {
      console.log(
        theme.success(`\n  ${theme.statusIcon('pass')} You have ${nsInfo.provider} configured. Redirecting...\n`),
      );
      const { dnsSetup } = await import('./dns-setup');
      await dnsSetup(targetDomain);
      return;
    }

    console.log(theme.info(`\n  ${theme.statusIcon('info')} To manage DNS records:`));
    console.log(
      theme.muted(`  - Run ${theme.bold(`mxroute dns setup ${targetDomain}`)} to configure via registrar API`),
    );
    console.log(theme.muted(`  - Or add records directly in your DNS provider's dashboard\n`));

    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Add to DirectAdmin anyway? (will NOT take effect)',
        default: false,
      },
    ]);
    if (!proceed) return;
  }

  console.log(theme.heading(`Add DNS Record to ${targetDomain}`));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Record type:',
      choices: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV'],
    },
    {
      type: 'input',
      name: 'name',
      message: theme.secondary('Record name (e.g. @ or subdomain):'),
      default: '@',
      validate: (input: string) => (input.trim() ? true : 'Name is required'),
    },
    {
      type: 'input',
      name: 'value',
      message: theme.secondary('Record value:'),
      validate: (input: string) => (input.trim() ? true : 'Value is required'),
    },
    {
      type: 'input',
      name: 'priority',
      message: theme.secondary('Priority:'),
      default: '10',
      when: (ans: any) => ans.type === 'MX',
      validate: (input: string) => {
        const num = parseInt(input, 10);
        return !isNaN(num) && num >= 0 ? true : 'Priority must be a non-negative number';
      },
    },
  ]);

  const priority = answers.type === 'MX' ? parseInt(answers.priority, 10) : undefined;

  console.log('');
  console.log(theme.subheading('Record to add:'));
  console.log(theme.keyValue('Type', answers.type));
  console.log(theme.keyValue('Name', answers.name));
  console.log(theme.keyValue('Value', answers.value));
  if (priority !== undefined) {
    console.log(theme.keyValue('Priority', String(priority)));
  }
  console.log('');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Add this ${answers.type} record to ${targetDomain}?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({ text: 'Adding DNS record...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await addDnsRecord(creds, targetDomain, answers.type, answers.name, answers.value, priority);

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to add DNS record'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      spinner.succeed(chalk.green(`${answers.type} record added to ${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to add DNS record'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function dnsapiDelete(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);
  const config = getConfig();

  // Check if MXroute is the DNS authority
  const nsInfo = await checkNameservers(targetDomain, config.server);
  if (!nsInfo.isMxrouteAuthority) {
    console.log(theme.warning(`\n  ${theme.statusIcon('warn')} ${targetDomain} DNS is NOT managed by MXroute.`));
    console.log(theme.muted(`  Nameservers: ${nsInfo.nameservers.join(', ')}`));
    if (nsInfo.provider) {
      console.log(theme.muted(`  DNS provider detected: ${theme.bold(nsInfo.provider)}`));
    }
    console.log(theme.warning(`\n  Deleting records from DirectAdmin will have NO effect on live DNS.`));
    console.log(theme.muted(`  Manage records at your DNS provider (${nsInfo.provider || 'unknown'}) instead.\n`));

    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Delete from DirectAdmin anyway?',
        default: false,
      },
    ]);
    if (!proceed) return;
  }

  console.log(theme.heading(`Delete DNS Record from ${targetDomain}`));

  const spinner = ora({
    text: `Fetching DNS records for ${targetDomain}...`,
    spinner: 'dots12',
    color: 'cyan',
  }).start();

  try {
    const raw = await listDnsRecords(creds, targetDomain);
    spinner.stop();

    const records = parseRecords(raw);

    if (records.length === 0) {
      console.log(theme.muted('  No DNS records to delete.\n'));
      return;
    }

    const choices = records.map((rec, i) => {
      const priStr = rec.priority !== undefined ? ` (pri: ${rec.priority})` : '';
      const ttlStr = rec.ttl !== undefined ? ` [TTL: ${rec.ttl}]` : '';
      const label = `${chalk.hex('#FFD600')(rec.type.padEnd(6))} ${rec.name.padEnd(22)} ${truncateValue(rec.value, 36)}${priStr}${ttlStr}`;
      return { name: label, value: i };
    });

    const { index } = await inquirer.prompt([
      {
        type: 'list',
        name: 'index',
        message: 'Select record to delete:',
        choices,
        pageSize: 20,
      },
    ]);

    const selected = records[index];

    console.log('');
    console.log(theme.subheading('Record to delete:'));
    console.log(theme.keyValue('Type', selected.type));
    console.log(theme.keyValue('Name', selected.name));
    console.log(theme.keyValue('Value', selected.value));
    console.log('');

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.hex('#FF5252')(`Delete this ${selected.type} record from ${targetDomain}?`),
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const delSpinner = ora({ text: 'Deleting DNS record...', spinner: 'dots12', color: 'red' }).start();
    const result = await deleteDnsRecord(creds, targetDomain, selected.type, selected.name, selected.value);

    if (result.error && result.error !== '0') {
      delSpinner.fail(chalk.red('Failed to delete DNS record'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      delSpinner.succeed(chalk.green(`Deleted ${selected.type} record from ${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function dnsapiDkim(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  if (!isJsonMode()) console.log(theme.heading(`DKIM Key: ${targetDomain}`));

  const spinner = isJsonMode()
    ? null
    : ora({ text: `Fetching DKIM key for ${targetDomain}...`, spinner: 'dots12', color: 'cyan' }).start();

  try {
    const dkimValue = await getDkimKey(creds, targetDomain);
    spinner?.stop();

    const recordName = `x._domainkey.${targetDomain}`;

    if (isJsonMode()) {
      output('domain', targetDomain);
      output('recordName', recordName);
      output('value', dkimValue || null);
      output('found', !!dkimValue);
      return;
    }

    if (!dkimValue) {
      console.log(`  ${theme.statusIcon('warn')} ${theme.warning('No DKIM key found for this domain.')}\n`);
      console.log(theme.subheading('To generate a DKIM key:'));
      console.log(theme.muted('    1. Log in to your DirectAdmin Control Panel'));
      console.log(theme.muted(`    2. Navigate to E-Mail Manager > ${targetDomain}`));
      console.log(theme.muted('    3. Click on "DKIM Keys" or "DomainKeys"'));
      console.log(theme.muted('    4. Generate a new DKIM key'));
      console.log(theme.muted(`    5. Run ${theme.bold('mxroute dnsapi dkim ' + targetDomain)} again to view it`));
      console.log('');
      return;
    }

    console.log(
      theme.box(
        [
          theme.keyValue('Record Type', 'TXT', 2),
          theme.keyValue('Record Name', recordName, 2),
          '',
          `  ${chalk.hex('#7C8DB0')('Value:')}`,
          `  ${chalk.hex('#00E676')(dkimValue)}`,
        ].join('\n'),
        'DKIM Record',
      ),
    );

    console.log('');
    console.log(theme.subheading('Add this TXT record to your external DNS provider'));
    console.log(theme.muted(`    Name:   ${recordName}`));
    console.log(theme.muted('    Type:   TXT'));
    console.log(theme.muted(`    Value:  ${dkimValue}`));
    console.log('');
  } catch (err: any) {
    spinner?.fail(chalk.red('Failed to fetch DKIM key'));
    if (!isJsonMode()) console.log(theme.error(`  ${err.message}\n`));
  }
}
