import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { getCreds, validateDomain } from '../utils/shared';
import { listDomains, createEmailAccount, listEmailAccounts, getDkimKey } from '../utils/directadmin';
import { getProvider, generateMxrouteRecords, RegistrarConfig } from '../utils/registrars';
import { runFullDnsCheck } from '../utils/dns';

export async function onboardCommand(domain?: string): Promise<void> {
  const config = getConfig();
  const creds = getCreds();

  console.log(theme.heading('Domain Onboarding'));
  console.log(theme.muted('  Complete domain setup in one command.\n'));

  // Step 1: Domain
  if (!domain) {
    const { d } = await inquirer.prompt([
      {
        type: 'input',
        name: 'd',
        message: theme.secondary('Domain to onboard:'),
        validate: validateDomain,
      },
    ]);
    domain = d;
  }

  // Check if domain already exists
  const existingDomains = await listDomains(creds);
  const alreadyExists = existingDomains.includes(domain!);

  console.log(theme.subheading(`Domain: ${domain}`));
  console.log(
    alreadyExists
      ? theme.success(`  ${theme.statusIcon('pass')} Already on your MXroute account`)
      : theme.muted(`  ${theme.statusIcon('info')} Will need to be added via Control Panel`),
  );
  console.log('');

  // Step 2: Standard accounts
  const { createAccounts } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createAccounts',
      message: 'Create standard email accounts? (admin@, postmaster@, abuse@)',
      default: true,
    },
  ]);

  let customAccounts: string[] = [];
  const { addCustom } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addCustom',
      message: 'Add custom email accounts?',
      default: false,
    },
  ]);

  if (addCustom) {
    const { accounts } = await inquirer.prompt([
      {
        type: 'input',
        name: 'accounts',
        message: theme.secondary('Account names (comma-separated, e.g., info,hello,support):'),
      },
    ]);
    customAccounts = accounts
      .split(',')
      .map((a: string) => a.trim())
      .filter((a: string) => a);
  }

  // Step 3: DNS setup
  const registrarConfig: RegistrarConfig | null = (config as any).registrar
    ? {
        provider: (config as any).registrar.provider,
        apiKey: (config as any).registrar.apiKey,
        apiSecret: (config as any).registrar.apiSecret,
      }
    : null;
  const provider = registrarConfig ? getProvider(registrarConfig.provider) : null;

  const hasDns = !!provider && !!registrarConfig;

  // Step 4: Confirm plan
  console.log(theme.heading('Onboarding Plan'));
  const steps: string[] = [];

  if (createAccounts) {
    steps.push('Create admin@, postmaster@, abuse@ accounts');
  }
  if (customAccounts.length > 0) {
    steps.push(`Create ${customAccounts.join(', ')}@ accounts`);
  }
  if (hasDns) {
    steps.push(`Configure DNS via ${provider!.name} (MX, SPF, DKIM, DMARC)`);
  } else {
    steps.push('Generate DNS records (manual setup — no registrar configured)');
  }
  steps.push('Verify DNS configuration');

  for (let i = 0; i < steps.length; i++) {
    console.log(`  ${theme.secondary(`${i + 1}.`)} ${steps[i]}`);
  }
  console.log('');

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: `Proceed with onboarding ${domain}?`,
      default: true,
    },
  ]);

  if (!proceed) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  // Execute
  console.log(theme.heading('Executing'));

  // Create accounts
  const allAccounts = [];
  if (createAccounts) allAccounts.push('admin', 'postmaster', 'abuse');
  allAccounts.push(...customAccounts);

  if (allAccounts.length > 0 && alreadyExists) {
    // Check which accounts already exist before creating
    let existingEmailAccounts: string[] = [];
    try {
      existingEmailAccounts = await listEmailAccounts(creds, domain!);
    } catch {
      // Can't list existing accounts — will attempt to create all
    }

    const createdAccounts: { email: string; password: string }[] = [];
    for (const account of allAccounts) {
      if (existingEmailAccounts.includes(account)) {
        console.log(`  ${theme.statusIcon('pass')} ${account}@${domain} already exists — skipping`);
        continue;
      }

      const spinner = ora({ text: `Creating ${account}@${domain}...`, spinner: 'dots12', color: 'cyan' }).start();
      try {
        // Generate a random password
        const password = generatePassword();
        const result = await createEmailAccount(creds, domain!, account, password);
        if (result.error && result.error !== '0') {
          spinner.warn(`${account}@${domain}: ${result.text || 'may already exist'}`);
        } else {
          spinner.succeed(`${account}@${domain}`);
          createdAccounts.push({ email: `${account}@${domain}`, password });
        }
      } catch (err: any) {
        spinner.warn(`${account}@${domain}: ${err.message}`);
      }
    }

    if (createdAccounts.length > 0) {
      console.log('');
      const credLines = createdAccounts.map((a) => theme.keyValue(a.email, a.password, 0));
      console.log(theme.box(credLines.join('\n'), 'Created Account Passwords'));
      console.log('');
      console.log(theme.warning(`  ${theme.statusIcon('warn')} Save these passwords now — they won't be shown again!`));
    }
    console.log('');
  } else if (allAccounts.length > 0 && !alreadyExists) {
    console.log(
      theme.warning(
        `\n  ${theme.statusIcon('warn')} Domain not yet on MXroute — add it via Control Panel first, then re-run onboard.\n`,
      ),
    );
  }

  // DNS setup
  if (hasDns) {
    console.log(theme.subheading('Configuring DNS'));

    // Get DKIM key
    let dkimKey: string | null = null;
    if (alreadyExists) {
      const dkimSpinner = ora({ text: 'Fetching DKIM key...', spinner: 'dots12', color: 'cyan' }).start();
      dkimKey = await getDkimKey(creds, domain!);
      dkimSpinner.stop();
    }

    const records = generateMxrouteRecords(config.server, domain!, dkimKey || undefined);

    for (const record of records) {
      const spinner = ora({ text: `${record.type} ${record.name}...`, spinner: 'dots12', color: 'cyan' }).start();
      try {
        const result = await provider!.createRecord(registrarConfig!, domain!, record);
        if (result.success) {
          spinner.succeed(`${record.type} ${record.name}`);
        } else {
          spinner.warn(`${record.type} ${record.name}: ${result.message}`);
        }
      } catch (err: any) {
        spinner.warn(`${record.type} ${record.name}: ${err.message}`);
      }
    }
  } else {
    console.log(theme.subheading('DNS Records (manual setup)'));
    console.log(theme.muted(`  Run: ${theme.bold(`mxroute dns records ${domain}`)} to see required records`));
    console.log(theme.muted(`  Or:  ${theme.bold(`mxroute dns setup ${domain}`)} to configure via registrar API`));
  }

  // Verify
  console.log('');
  console.log(theme.subheading('Verification'));
  const verifySpinner = ora({ text: 'Checking DNS...', spinner: 'dots12', color: 'cyan' }).start();
  try {
    const results = await runFullDnsCheck(domain!, config.server);
    verifySpinner.stop();
    const passed = results.filter((r) => r.status === 'pass').length;
    const total = results.length;
    for (const r of results) {
      console.log(`    ${theme.statusIcon(r.status)} ${r.type.padEnd(6)} ${theme.muted(r.message)}`);
    }
    console.log('');
    if (passed === total) {
      console.log(theme.success(`  ${theme.statusIcon('pass')} ${domain} is fully configured!`));
    } else {
      console.log(
        theme.info(`  ${theme.statusIcon('info')} ${passed}/${total} checks passing. DNS may need time to propagate.`),
      );
      console.log(theme.muted(`  Run ${theme.bold(`mxroute dns watch ${domain}`)} to monitor propagation.`));
    }
  } catch {
    verifySpinner.stop();
    console.log(theme.muted('  DNS verification will work after propagation.'));
  }

  // Generate share page
  console.log('');
  console.log(theme.subheading('Next steps'));
  console.log(theme.muted(`    mxroute share              Generate setup instructions for users`));
  console.log(theme.muted(`    mxroute accounts list ${domain}  View created accounts`));
  console.log(theme.muted(`    mxroute dns watch ${domain}      Monitor DNS propagation`));
  console.log('');
}

function generatePassword(length = 16): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let password = '';
  const array = new Uint8Array(length);
  require('crypto').randomFillSync(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}
