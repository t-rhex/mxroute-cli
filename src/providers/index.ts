// src/providers/index.ts
import { DnsProvider } from './types';

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

// Re-export types
export { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult, CredentialField } from './types';
