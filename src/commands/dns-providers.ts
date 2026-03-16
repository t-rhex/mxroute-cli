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
  // Show setup hints for unconfigured providers with domains
  if (config.daUsername && config.daLoginKey) {
    const unconfiguredProviders = new Set<string>();
    // Collect which providers need setup (already computed above in domain loop)
    for (const p of providers) {
      if (!providerCreds[p.id] && p.id !== 'namecheap') {
        unconfiguredProviders.add(p.id);
      }
    }
  }

  console.log('');
  console.log(theme.subheading('Setup'));
  console.log(theme.muted('  Configure a provider:  mxroute dns providers-setup <provider-id>'));
  console.log(theme.muted('  Example:               mxroute dns providers-setup cloudflare'));
  console.log('');
}

function showProviderInstructions(providerId: string): void {
  const instructions: Record<string, string[]> = {
    cloudflare: [
      'How to create a Cloudflare API Token:',
      '  1. Go to https://dash.cloudflare.com/profile/api-tokens',
      '  2. Click "Create Token"',
      '  3. Use the "Edit zone DNS" template, or create custom:',
      '     - Permissions: Zone → DNS → Edit, Zone → Zone → Read',
      '     - Zone Resources: Include → All Zones (or specific zones)',
      '  4. Click "Continue to summary" → "Create Token"',
      '  5. Copy the token (shown only once!)',
      '',
      '  Tip: Use "All Zones" to manage DNS for all your domains with one token.',
    ],
    porkbun: [
      'How to get Porkbun API credentials:',
      '  1. Go to https://porkbun.com/account/api',
      '  2. Enable API Access for your account',
      "  3. Create an API Key — you'll get:",
      '     - API Key (pk1_xxx)',
      '     - Secret Key (sk1_xxx)',
      '  4. Enable API access per domain in Domain Management',
    ],
    digitalocean: [
      'How to create a DigitalOcean API Token:',
      '  1. Go to https://cloud.digitalocean.com/account/api/tokens',
      '  2. Click "Generate New Token"',
      '  3. Name it (e.g., "mxroute-cli")',
      '  4. Select "Read and Write" scope',
      '  5. Copy the token',
    ],
    godaddy: [
      'How to get GoDaddy API credentials:',
      '  1. Go to https://developer.godaddy.com/keys',
      '  2. Create a new API Key',
      '  3. Choose "Production" environment',
      "  4. You'll get an API Key and API Secret",
      '',
      '  Note: Production keys have higher rate limits than test keys.',
    ],
    hetzner: [
      'How to create a Hetzner DNS API Token:',
      '  1. Go to https://dns.hetzner.com/settings/api-token',
      '  2. Click "Create API Token"',
      '  3. Copy the token',
    ],
    vercel: [
      'How to create a Vercel API Token:',
      '  1. Go to https://vercel.com/account/tokens',
      '  2. Click "Create"',
      '  3. Name it (e.g., "mxroute-cli")',
      '  4. Set scope (Full Account recommended)',
      '  5. Copy the token',
    ],
    route53: [
      'How to get AWS Route53 credentials:',
      '  1. Go to AWS IAM Console → Users → Your user → Security credentials',
      '  2. Create an Access Key (or use an existing one)',
      '  3. You need: Access Key ID + Secret Access Key',
      '  4. Region: us-east-1 (Route53 is global but requires a region)',
      '',
      '  Note: Route53 support is detection-only in this version.',
      '  For full CRUD, use: aws route53 change-resource-record-sets',
    ],
    google: [
      'How to get Google Cloud DNS credentials:',
      '  1. Go to GCP Console → IAM → Service Accounts',
      '  2. Create a service account with "DNS Administrator" role',
      '  3. Create a JSON key for the service account',
      '  4. Download the JSON key file',
      '  5. You need: path to JSON file + GCP Project ID',
      '',
      '  Note: Google Cloud DNS support is detection-only in this version.',
      '  For full CRUD, use: gcloud dns record-sets create',
    ],
    namecheap: [
      'Namecheap DNS limitation:',
      "  Namecheap's API requires setting ALL records at once (atomic operation).",
      '  Individual record CRUD is not supported.',
      '',
      "  Recommended: Point your Namecheap domain's nameservers to Cloudflare",
      "  (free plan), then use Cloudflare's API for DNS management.",
      '  This takes ~5 minutes and gives you full API access.',
    ],
  };

  const lines = instructions[providerId];
  if (lines) {
    for (const line of lines) {
      console.log(theme.muted(`  ${line}`));
    }
  }
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

  // Show provider-specific setup instructions
  showProviderInstructions(provider.id);
  console.log('');

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
