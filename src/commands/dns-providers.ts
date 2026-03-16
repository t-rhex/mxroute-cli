import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig, setConfig } from '../utils/config';
import { listProviders, detectProvider } from '../providers';
import { listDomains } from '../utils/directadmin';
import { getCreds } from '../utils/shared';
import { Resolver } from 'dns';
import { promisify } from 'util';

const resolver = new Resolver();
const resolveNs = promisify(resolver.resolveNs.bind(resolver));

export async function dnsProvidersCommand(): Promise<void> {
  const config = getConfig() as any;
  const providers = listProviders();
  const providerCreds = config.providers || {};

  console.log(theme.heading('Supported DNS Providers'));
  for (const p of providers) {
    const configured = !!providerCreds[p.id];
    const icon = configured ? theme.statusIcon('pass') : theme.statusIcon('fail');
    const status = configured ? theme.success('configured') : theme.muted('not configured');
    console.log(`  ${icon} ${theme.bold(p.name.padEnd(22))} ${status}`);
  }

  // Show domain → provider mapping if authenticated
  if (config.daUsername && config.daLoginKey) {
    console.log('');
    console.log(theme.subheading('Your domains'));
    const spinner = ora({ text: 'Detecting providers...', spinner: 'dots12', color: 'cyan' }).start();
    try {
      const creds = getCreds();
      const domains = await listDomains(creds);
      spinner.stop();
      for (const domain of domains) {
        try {
          const ns = await resolveNs(domain);
          const normalized = ns.map((n: string) => n.toLowerCase().replace(/\.$/, ''));
          const provider = detectProvider(normalized);
          const configured = provider ? !!providerCreds[provider.id] : false;
          const providerName = provider ? provider.name : 'Unknown';
          const icon = configured ? theme.statusIcon('pass') : theme.statusIcon('warn');
          console.log(
            `  ${icon} ${theme.bold(domain.padEnd(28))} → ${providerName}${configured ? '' : theme.muted(' (no credentials)')}`,
          );
        } catch {
          console.log(
            `  ${theme.statusIcon('warn')} ${theme.bold(domain.padEnd(28))} → ${theme.muted('could not resolve NS')}`,
          );
        }
      }
    } catch {
      spinner.stop();
      console.log(theme.muted('  Could not list domains (not authenticated)'));
    }
  }
  console.log('');
}

export async function dnsProvidersSetup(providerId: string): Promise<void> {
  const { getProvider } = await import('../providers');
  const provider = getProvider(providerId);
  if (!provider) {
    const allProviders = listProviders();
    console.log(theme.error(`\n  Unknown provider: ${providerId}`));
    console.log(theme.muted(`  Available: ${allProviders.map((p) => p.id).join(', ')}\n`));
    return;
  }

  const inquirer = (await import('inquirer')).default;

  console.log(theme.heading(`Configure ${provider.name}`));

  const prompts = provider.credentialFields.map((f) => ({
    type: f.secret ? 'password' : 'input',
    name: f.name,
    message: theme.secondary(`${f.label}:`),
    mask: f.secret ? '•' : undefined,
    validate: (input: string) => (input.trim() ? true : `${f.label} is required`),
  }));

  const answers = await inquirer.prompt(prompts);

  // Validate
  const validationError = provider.validateCredentials(answers);
  if (validationError) {
    console.log(theme.error(`\n  ${validationError}\n`));
    return;
  }

  // Test authentication
  const spinner = ora({ text: `Testing ${provider.name} authentication...`, spinner: 'dots12', color: 'cyan' }).start();
  const authOk = await provider.authenticate(answers);
  if (authOk) {
    spinner.succeed(`${provider.name} authenticated`);
    // Save to config
    const config = getConfig() as any;
    const providers = config.providers || {};
    providers[provider.id] = answers;
    setConfig('providers', providers);
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Credentials saved for ${provider.name}\n`));
  } else {
    spinner.fail(`${provider.name} authentication failed`);
    console.log(theme.error('\n  Check your credentials and try again.\n'));
  }
}
