import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig, setConfig } from '../utils/config';
import { getCreds } from '../utils/shared';
import { getDkimKey } from '../utils/directadmin';
import { getProviderList, getProvider, generateMxrouteRecords, RegistrarConfig } from '../utils/registrars';

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
  const providers = getProviderList();
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

  const savedRegistrar = (config as any).registrar || {};
  const prompts: any[] = [
    {
      type: 'password',
      name: 'apiKey',
      message: theme.secondary(`${provider.name} API Key/Token:`),
      mask: '\u2022',
      default: savedRegistrar.provider === providerId ? savedRegistrar.apiKey : undefined,
      validate: (input: string) => (input.trim() ? true : 'Required'),
    },
  ];

  // Porkbun needs secret key, Namecheap needs username
  if (providerId === 'porkbun') {
    prompts.push({
      type: 'password',
      name: 'apiSecret',
      message: theme.secondary('Porkbun Secret API Key:'),
      mask: '\u2022',
      default: savedRegistrar.provider === providerId ? savedRegistrar.apiSecret : undefined,
      validate: (input: string) => (input.trim() ? true : 'Required'),
    });
  } else if (providerId === 'namecheap') {
    prompts.push({
      type: 'input',
      name: 'apiSecret',
      message: theme.secondary('Namecheap Username:'),
      default: savedRegistrar.provider === providerId ? savedRegistrar.apiSecret : undefined,
      validate: (input: string) => (input.trim() ? true : 'Required'),
    });
  }

  const creds = await inquirer.prompt(prompts);

  const registrarConfig: RegistrarConfig = {
    provider: providerId,
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret,
  };

  // Verify auth
  const authSpinner = ora({
    text: `Authenticating with ${provider.name}...`,
    spinner: 'dots12',
    color: 'cyan',
  }).start();
  const authOk = await provider.authenticate(registrarConfig);
  if (!authOk) {
    authSpinner.fail(chalk.red(`${provider.name} authentication failed`));
    return;
  }
  authSpinner.succeed(chalk.green(`${provider.name} authenticated`));

  // Save registrar config for future use
  const { saveRegistrar } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveRegistrar',
      message: `Save ${provider.name} API credentials for future use?`,
      default: false,
    },
  ]);

  if (saveRegistrar) {
    setConfig('registrar', { provider: providerId, apiKey: creds.apiKey, apiSecret: creds.apiSecret });
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

  // Confirm
  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: `Create ${records.length} DNS records on ${provider.name}?`,
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

  for (const record of records) {
    const spinner = ora({
      text: `${record.type} ${record.name}...`,
      spinner: 'dots12',
      color: 'cyan',
    }).start();

    try {
      const result = await provider.createRecord(registrarConfig, domain!, record);
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
