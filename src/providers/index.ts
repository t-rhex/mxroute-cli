// src/providers/index.ts
import { DnsProvider } from './types';
import { cloudflare } from './cloudflare';
import { porkbun } from './porkbun';
import { digitalocean } from './digitalocean';
import { namecheap } from './namecheap';

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

// Re-export types
export { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult, CredentialField } from './types';
