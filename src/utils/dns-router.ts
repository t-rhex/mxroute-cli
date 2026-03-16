import { Resolver } from 'dns';
import { promisify } from 'util';
import { getConfig, setConfig } from './config';
import { detectProvider, getProvider } from '../providers';
import { DnsRecord, ProviderCredentials } from '../providers/types';
import { logActivity } from './activity-log';
import {
  addDnsRecord as daAddDnsRecord,
  deleteDnsRecord as daDeleteDnsRecord,
  listDnsRecords as daListDnsRecords,
} from './directadmin';

const resolver = new Resolver();
const resolveNs = promisify(resolver.resolveNs.bind(resolver));

export interface RouteResult {
  success: boolean;
  message: string;
  provider: string;
  method: 'registrar' | 'directadmin' | 'none';
}

/**
 * Migrate legacy config.registrar to config.providers format.
 */
export function migrateConfig(): void {
  const config = getConfig() as any;
  if (config.registrar && config.registrar.provider && !config.providers) {
    const providers: Record<string, any> = {};
    providers[config.registrar.provider] = {
      apiKey: config.registrar.apiKey,
      ...(config.registrar.apiSecret ? { apiSecret: config.registrar.apiSecret } : {}),
    };
    setConfig('providers', providers);
    setConfig('configVersion', 2);
  }
}

/**
 * Load credentials for a given provider from config.providers[providerId].
 */
export function getProviderCreds(providerId: string): ProviderCredentials | null {
  migrateConfig();
  const config = getConfig() as any;
  const providers = config.providers || {};
  return providers[providerId] || null;
}

/**
 * Check if MXroute is the DNS authority for the given nameservers.
 */
export function isMxrouteAuthority(nameservers: string[], server: string): boolean {
  return nameservers.some((ns) => {
    const n = ns.toLowerCase().replace(/\.$/, '');
    return n.includes('mxrouting.net') || n.includes(server);
  });
}

/**
 * Resolve nameservers for a domain. Returns empty array on failure.
 */
async function resolveNameservers(domain: string): Promise<string[]> {
  try {
    const ns = await resolveNs(domain);
    return ns.map((n: string) => n.toLowerCase().replace(/\.$/, ''));
  } catch {
    return [];
  }
}

/**
 * Route a DNS add operation to the correct provider or DirectAdmin.
 */
export async function routeDnsAdd(domain: string, record: DnsRecord): Promise<RouteResult> {
  const config = getConfig() as any;
  const nameservers = await resolveNameservers(domain);

  if (nameservers.length === 0) {
    return {
      success: false,
      message: `Could not resolve nameservers for ${domain}`,
      provider: 'none',
      method: 'none',
    };
  }

  // Try to detect a known registrar provider
  const provider = detectProvider(nameservers);
  if (provider) {
    const creds = getProviderCreds(provider.id);
    if (creds) {
      const validationError = provider.validateCredentials(creds);
      if (validationError) {
        return {
          success: false,
          message: `Invalid credentials for ${provider.name}: ${validationError}`,
          provider: provider.id,
          method: 'none',
        };
      }
      try {
        const result = await provider.createRecord(creds, domain, record);
        if (result.success) {
          logActivity({
            action: 'dns.add',
            domain,
            details: `Added ${record.type} ${record.name} via ${provider.id}`,
            result: 'success',
          });
        }
        return {
          success: result.success,
          message: result.message,
          provider: provider.id,
          method: 'registrar',
        };
      } catch (err: any) {
        return {
          success: false,
          message: `${provider.name} API error: ${err.message}`,
          provider: provider.id,
          method: 'registrar',
        };
      }
    }
    // Provider detected but no creds configured
    return {
      success: false,
      message: `DNS is managed by ${provider.name} but no credentials configured. Run: mxroute dns providers-setup ${provider.id}`,
      provider: provider.id,
      method: 'none',
    };
  }

  // Fallback: if MXroute is the DNS authority, use DirectAdmin
  if (isMxrouteAuthority(nameservers, config.server || '')) {
    try {
      const creds = {
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      };
      const result = await daAddDnsRecord(creds, domain, record.type, record.name, record.value, record.priority);
      const success = !result.error || result.error === '0';
      if (success) {
        logActivity({
          action: 'dns.add',
          domain,
          details: `Added ${record.type} ${record.name} via mxroute`,
          result: 'success',
        });
      }
      return {
        success,
        message: success ? `Added ${record.type} record via DirectAdmin` : result.text || 'Failed',
        provider: 'mxroute',
        method: 'directadmin',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `DirectAdmin error: ${err.message}`,
        provider: 'mxroute',
        method: 'directadmin',
      };
    }
  }

  // No provider matched and not MXroute authority
  return {
    success: false,
    message: `Cannot manage DNS for ${domain}. Nameservers (${nameservers.join(', ')}) don't match any configured provider.`,
    provider: 'unknown',
    method: 'none',
  };
}

/**
 * Route a DNS delete operation to the correct provider or DirectAdmin.
 */
export async function routeDnsDelete(domain: string, record: DnsRecord): Promise<RouteResult> {
  const config = getConfig() as any;
  const nameservers = await resolveNameservers(domain);

  if (nameservers.length === 0) {
    return {
      success: false,
      message: `Could not resolve nameservers for ${domain}`,
      provider: 'none',
      method: 'none',
    };
  }

  const provider = detectProvider(nameservers);
  if (provider) {
    const creds = getProviderCreds(provider.id);
    if (creds) {
      const validationError = provider.validateCredentials(creds);
      if (validationError) {
        return {
          success: false,
          message: `Invalid credentials for ${provider.name}: ${validationError}`,
          provider: provider.id,
          method: 'none',
        };
      }
      try {
        const result = await provider.deleteRecord(creds, domain, record);
        if (result.success) {
          logActivity({
            action: 'dns.delete',
            domain,
            details: `Deleted ${record.type} ${record.name} via ${provider.id}`,
            result: 'success',
          });
        }
        return {
          success: result.success,
          message: result.message,
          provider: provider.id,
          method: 'registrar',
        };
      } catch (err: any) {
        return {
          success: false,
          message: `${provider.name} API error: ${err.message}`,
          provider: provider.id,
          method: 'registrar',
        };
      }
    }
    return {
      success: false,
      message: `DNS is managed by ${provider.name} but no credentials configured. Run: mxroute dns providers-setup ${provider.id}`,
      provider: provider.id,
      method: 'none',
    };
  }

  if (isMxrouteAuthority(nameservers, config.server || '')) {
    try {
      const creds = {
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      };
      const result = await daDeleteDnsRecord(creds, domain, record.type, record.name, record.value);
      const success = !result.error || result.error === '0';
      if (success) {
        logActivity({
          action: 'dns.delete',
          domain,
          details: `Deleted ${record.type} ${record.name} via mxroute`,
          result: 'success',
        });
      }
      return {
        success,
        message: success ? `Deleted ${record.type} record via DirectAdmin` : result.text || 'Failed',
        provider: 'mxroute',
        method: 'directadmin',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `DirectAdmin error: ${err.message}`,
        provider: 'mxroute',
        method: 'directadmin',
      };
    }
  }

  return {
    success: false,
    message: `Cannot manage DNS for ${domain}. Nameservers (${nameservers.join(', ')}) don't match any configured provider.`,
    provider: 'unknown',
    method: 'none',
  };
}

/**
 * Route a DNS list operation to the correct provider or DirectAdmin.
 */
export async function routeDnsList(domain: string): Promise<RouteResult & { records?: DnsRecord[] }> {
  const config = getConfig() as any;
  const nameservers = await resolveNameservers(domain);

  if (nameservers.length === 0) {
    return {
      success: false,
      message: `Could not resolve nameservers for ${domain}`,
      provider: 'none',
      method: 'none',
    };
  }

  const provider = detectProvider(nameservers);
  if (provider) {
    const creds = getProviderCreds(provider.id);
    if (creds) {
      const validationError = provider.validateCredentials(creds);
      if (validationError) {
        return {
          success: false,
          message: `Invalid credentials for ${provider.name}: ${validationError}`,
          provider: provider.id,
          method: 'none',
        };
      }
      try {
        const records = await provider.listRecords(creds, domain);
        return {
          success: true,
          message: `Listed ${records.length} records via ${provider.name}`,
          provider: provider.id,
          method: 'registrar',
          records,
        };
      } catch (err: any) {
        return {
          success: false,
          message: `${provider.name} API error: ${err.message}`,
          provider: provider.id,
          method: 'registrar',
        };
      }
    }
    return {
      success: false,
      message: `DNS is managed by ${provider.name} but no credentials configured.`,
      provider: provider.id,
      method: 'none',
    };
  }

  if (isMxrouteAuthority(nameservers, config.server || '')) {
    try {
      const creds = {
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      };
      // daListDnsRecords returns raw DirectAdmin data; actual DnsRecord[] parsing
      // is handled by the consumer (dnsapi.ts uses its own parseRecords).
      // We return an empty records array here; callers that need records should
      // use daListDnsRecords directly.
      await daListDnsRecords(creds, domain);
      return {
        success: true,
        message: 'Listed records via DirectAdmin',
        provider: 'mxroute',
        method: 'directadmin',
        records: [],
      };
    } catch (err: any) {
      return {
        success: false,
        message: `DirectAdmin error: ${err.message}`,
        provider: 'mxroute',
        method: 'directadmin',
      };
    }
  }

  return {
    success: false,
    message: `Cannot manage DNS for ${domain}. Nameservers (${nameservers.join(', ')}) don't match any configured provider.`,
    provider: 'unknown',
    method: 'none',
  };
}
