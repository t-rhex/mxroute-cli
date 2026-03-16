// src/providers/index.ts
import { DnsProvider } from './types';
import { cloudflare } from './cloudflare';
import { porkbun } from './porkbun';
import { digitalocean } from './digitalocean';
import { namecheap } from './namecheap';
import { godaddy } from './godaddy';
import { hetzner } from './hetzner';
import { vercel } from './vercel';
import { route53 } from './route53';
import { google } from './google';

const registry = new Map<string, DnsProvider>();

export function registerProvider(provider: DnsProvider): void {
  registry.set(provider.id, provider);
}

export function getProvider(id: string): DnsProvider | undefined {
  return registry.get(id);
}

export function listProviders(): DnsProvider[] {
  return Array.from(registry.values());
}

export function detectProvider(nameservers: string[]): DnsProvider | null {
  const normalized = nameservers.map((ns) => ns.toLowerCase().replace(/\.$/, ''));
  for (const provider of registry.values()) {
    if (provider.nsPatterns.some((pattern) => normalized.some((ns) => ns.includes(pattern)))) {
      return provider;
    }
  }
  return null;
}

// Register built-in providers
registerProvider(cloudflare);
registerProvider(porkbun);
registerProvider(digitalocean);
registerProvider(namecheap);
registerProvider(godaddy);
registerProvider(hetzner);
registerProvider(vercel);
registerProvider(route53);
registerProvider(google);

// Re-export types
export { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult, CredentialField } from './types';
