import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig, setConfig } from '../utils/config';
import { getCreds } from '../utils/shared';
import { getDkimKey } from '../utils/directadmin';
import { listProviders, getProvider, ProviderCredentials } from '../providers';
import { generateMxrouteRecords } from '../providers/mxroute-records';

export async function dnsSetup(domain?: string): Promise<void> {
  const config = getConfig();
  const server = config.server;

  if (!server) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Run ${theme.bold('mxroute config setup')} first.\n`));
    process.exit(1);
  }

  // Pick domain
  if (!domain) {
    domain = config.domain;
    if (!domain) {
      const { d } = await inquirer.prompt([
        {
          type: 'input',
          name: 'd',
          message: theme.secondary('Domain to configure:'),
          validate: (input: string) => {
            if (!input.trim()) return 'Domain is required';
            if (!input.includes('.') || input.startsWith('.') || input.endsWith('.'))
              return 'Enter a valid domain (e.g., example.com)';
            return true;
          },
        },
      ]);
      domain = d;
    }
  }

  console.log(theme.heading(`DNS Setup: ${domain}`));
  console.log(theme.muted('  This will automatically create all required MXroute DNS records.\n'));

  // Step 1: Choose registrar
  const providers = listProviders();
  const { providerId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'providerId',
      message: 'Where are your DNS records managed?',
      choices: [
        ...providers.map((p) => ({ name: p.name, value: p.id })),
        { name: 'Other (show records for manual setup)', value: 'manual' },
      ],
    },
  ]);

  if (providerId === 'manual') {
    // Fall back to dns generate
    const { dnsGenerate } = await import('./dns');
    await dnsGenerate(domain);
    return;
  }

  const provider = getProvider(providerId);
  if (!provider) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Unknown provider.\n`));
    return;
  }

  // Step 2: Get API credentials
  console.log(theme.heading(`${provider.name} Authentication`));

  const savedProviders = (config as any).providers || {};
  const savedCreds: Record<string, string> = savedProviders[providerId] || {};

  const prompts: any[] = provider.credentialFields.map((field) => ({
    type: field.secret ? 'password' : 'input',
    name: field.name,
    message: theme.secondary(`${provider.name} ${field.label}:`),
    mask: field.secret ? '\u2022' : undefined,
    default: savedCreds[field.name] || undefined,
    validate: (input: string) => (input.trim() ? true : 'Required'),
  }));

  const creds: ProviderCredentials = await inquirer.prompt(prompts);

  // Verify auth
  const authSpinner = ora({
    text: `Authenticating with ${provider.name}...`,
    spinner: 'dots12',
    color: 'cyan',
  }).start();
  const authOk = await provider.authenticate(creds);
  if (!authOk) {
    authSpinner.fail(chalk.red(`${provider.name} authentication failed`));
    return;
  }
  authSpinner.succeed(chalk.green(`${provider.name} authenticated`));

  // Save provider config for future use
  const { saveProvider } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveProvider',
      message: `Save ${provider.name} API credentials for future use?`,
      default: false,
    },
  ]);

  if (saveProvider) {
    const updatedProviders = { ...savedProviders, [providerId]: creds };
    setConfig('providers', updatedProviders);
    console.log(theme.muted(`  Saved to ${require('../utils/config').getConfigPath()}\n`));
  }

  // Step 3: Fetch DKIM key from DirectAdmin
  let dkimKey: string | null = null;
  if (config.daUsername && config.daLoginKey) {
    const dkimSpinner = ora({ text: 'Fetching DKIM key from MXroute...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const daCreds = getCreds();
      dkimKey = await getDkimKey(daCreds, domain!);
      if (dkimKey) {
        dkimSpinner.succeed(chalk.green('DKIM key retrieved'));
      } else {
        dkimSpinner.warn(chalk.yellow('No DKIM key found \u2014 will skip DKIM record'));
      }
    } catch {
      dkimSpinner.warn(chalk.yellow('Could not fetch DKIM key \u2014 will skip DKIM record'));
    }
  } else {
    console.log(
      theme.warning(
        `\n  ${theme.statusIcon('warn')} Not authenticated with DirectAdmin \u2014 DKIM record will be skipped.`,
      ),
    );
    console.log(theme.muted(`  Run ${theme.bold('mxroute config setup')} to authenticate, then re-run dns setup.\n`));
  }

  // Step 4: Generate records
  const records = generateMxrouteRecords(server, domain!, dkimKey || undefined);

  // Step 5: Show what will be created
  console.log(theme.heading('Records to create'));
  for (const r of records) {
    const pri = r.priority !== undefined ? theme.muted(` (priority: ${r.priority})`) : '';
    const val = r.value.length > 60 ? r.value.substring(0, 57) + '...' : r.value;
    console.log(`  ${theme.secondary(r.type.padEnd(6))} ${theme.bold(r.name.padEnd(16))} ${val}${pri}`);
  }
  console.log('');

  // Optional: custom hostnames
  const { addCname } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addCname',
      message: 'Add custom hostname records (mail.domain, webmail.domain)?',
      default: false,
    },
  ]);

  if (addCname) {
    records.push(
      { type: 'CNAME', name: 'mail', value: `${server}.mxrouting.net`, ttl: 3600 },
      { type: 'CNAME', name: 'webmail', value: `${server}.mxrouting.net`, ttl: 3600 },
    );
  }

  // Pre-flight check: compare against existing records
  console.log(theme.heading('Pre-flight check'));

  let existingRecords: any[] = [];
  try {
    existingRecords = await provider.listRecords(creds, domain!);
  } catch {
    // Can't list existing records — proceed with creation
    console.log(theme.muted('  Could not check existing records — will attempt to create all.\n'));
  }

  const toCreate: typeof records = [];
  const alreadyExists: typeof records = [];

  for (const record of records) {
    const exists = existingRecords.some((existing) => {
      const nameMatch = existing.name === record.name || (existing.name === '@' && record.name === '@');
      const typeMatch = existing.type === record.type;
      const valueMatch = existing.value?.includes(record.value) || record.value?.includes(existing.value);
      return nameMatch && typeMatch && valueMatch;
    });

    if (exists) {
      alreadyExists.push(record);
    } else {
      toCreate.push(record);
    }
  }

  if (alreadyExists.length > 0) {
    console.log(theme.subheading('Already configured'));
    for (const r of alreadyExists) {
      console.log(`  ${theme.statusIcon('pass')} ${r.type} ${r.name}`);
    }
  }

  if (toCreate.length === 0) {
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} All records already exist! Nothing to create.\n`));
  } else {
    console.log(theme.subheading('Will create'));
    for (const r of toCreate) {
      console.log(`  ${theme.statusIcon('info')} ${r.type} ${r.name}`);
    }
    console.log('');

    // Confirm
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: `Create ${toCreate.length} DNS records on ${provider.name}?`,
        default: true,
      },
    ]);

    if (!proceed) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    // Step 6: Create records
    console.log(theme.heading('Creating DNS records'));
    let successCount = 0;
    let failCount = 0;

    for (const record of toCreate) {
      const spinner = ora({
        text: `${record.type} ${record.name}...`,
        spinner: 'dots12',
        color: 'cyan',
      }).start();

      try {
        const result = await provider.createRecord(creds, domain!, record);
        if (result.success) {
          spinner.succeed(`${record.type} ${record.name}`);
          successCount++;
        } else {
          spinner.fail(`${record.type} ${record.name}: ${result.message}`);
          failCount++;
        }
      } catch (err: any) {
        spinner.fail(`${record.type} ${record.name}: ${err.message}`);
        failCount++;
      }
    }

    console.log('');
    if (failCount === 0) {
      console.log(theme.success(`  ${theme.statusIcon('pass')} All ${successCount} records created successfully!`));
    } else {
      console.log(theme.warning(`  ${successCount} created, ${failCount} failed`));
    }
  }

  // Step 7: Verify with DNS check
  console.log('');
  const { verify } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'verify',
      message: 'Run DNS health check now? (may take a few minutes for propagation)',
      default: true,
    },
  ]);

  if (verify) {
    console.log(theme.muted('\n  Note: DNS changes can take 5-30 minutes to propagate.\n'));
    const { dnsCheck } = await import('./dns');
    await dnsCheck(domain);
  }

  console.log('');
}
