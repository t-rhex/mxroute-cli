import { createHash } from 'crypto';
import * as directadmin from './directadmin';
import { createMXrouteApiClient, MXrouteApiClient, MXrouteApiCredentials } from './mxroute-api';

export type { DACredentials } from './directadmin';

export interface ApiManagementCredentials extends MXrouteApiCredentials {
  backend: 'mxroute-api';
  legacy?: directadmin.DACredentials;
}

export type ManagementCredentials = directadmin.DACredentials | ApiManagementCredentials;

interface ManagementAdapters {
  api?: Partial<MXrouteApiClient>;
  legacy?: Partial<typeof directadmin>;
}

export class ManagementCapabilityError extends Error {
  readonly capability: string;

  constructor(capability: string) {
    super(
      `${capability} is not supported by the current MXroute API. Configure explicit legacy DirectAdmin credentials to use this feature.`,
    );
    this.name = 'ManagementCapabilityError';
    this.capability = capability;
  }
}

function isApiCredentials(credentials: ManagementCredentials): credentials is ApiManagementCredentials {
  return 'backend' in credentials && credentials.backend === 'mxroute-api';
}

const defaultApiClients = new Map<string, any>();

function apiClientCacheKey(credentials: ApiManagementCredentials): string {
  return createHash('sha256')
    .update(credentials.server)
    .update('\0')
    .update(credentials.username)
    .update('\0')
    .update(credentials.apiKey)
    .digest('hex');
}

export function createManagementClient(credentials: ManagementCredentials, adapters: ManagementAdapters = {}) {
  const cacheable = !adapters.api && !adapters.legacy;
  const cacheKey = cacheable && isApiCredentials(credentials) ? apiClientCacheKey(credentials) : undefined;
  if (cacheKey) {
    const cached = defaultApiClients.get(cacheKey);
    if (cached) return cached;
  }
  const legacy = { ...directadmin, ...adapters.legacy };
  const api = isApiCredentials(credentials) ? { ...createMXrouteApiClient(credentials), ...adapters.api } : undefined;

  function legacyCredentials(capability: string): directadmin.DACredentials {
    if (!isApiCredentials(credentials)) return credentials;
    if (credentials.legacy) return credentials.legacy;
    throw new ManagementCapabilityError(capability);
  }

  const mutationSuccess = { error: '0' };

  const client = {
    async listDomains(): Promise<string[]> {
      if (api) return api.listDomains!();
      return legacy.listDomains!(credentials as directadmin.DACredentials);
    },
    async getDomainInfo(domain: string): Promise<any> {
      if (api) return api.getDomain!(domain);
      return legacy.getDomainInfo!(credentials as directadmin.DACredentials, domain);
    },
    async listEmailAccounts(domain: string): Promise<string[]> {
      if (api) {
        const accounts = await api.listEmailAccounts!(domain);
        return accounts.map((account) => account.username).filter(Boolean);
      }
      return legacy.listEmailAccounts!(credentials as directadmin.DACredentials, domain);
    },
    async getEmailAccountInfo(domain: string, user: string): Promise<any> {
      if (api) return api.getEmailAccount!(domain, user);
      return legacy.getEmailAccountInfo!(credentials as directadmin.DACredentials, domain, user);
    },
    async createEmailAccount(domain: string, user: string, password: string, quota: number = 0): Promise<any> {
      if (api) {
        await api.createEmailAccount!(domain, { username: user, password, quota });
        return mutationSuccess;
      }
      return legacy.createEmailAccount!(credentials as directadmin.DACredentials, domain, user, password, quota);
    },
    async deleteEmailAccount(domain: string, user: string): Promise<any> {
      if (api) {
        await api.deleteEmailAccount!(domain, user);
        return mutationSuccess;
      }
      return legacy.deleteEmailAccount!(credentials as directadmin.DACredentials, domain, user);
    },
    async changeEmailPassword(domain: string, user: string, password: string): Promise<any> {
      if (api) {
        await api.updateEmailAccount!(domain, user, { password });
        return mutationSuccess;
      }
      return legacy.changeEmailPassword!(credentials as directadmin.DACredentials, domain, user, password);
    },
    async changeEmailQuota(domain: string, user: string, quota: number): Promise<any> {
      if (api) {
        await api.updateEmailAccount!(domain, user, { quota });
        return mutationSuccess;
      }
      return legacy.changeEmailQuota!(credentials as directadmin.DACredentials, domain, user, quota);
    },
    async listForwarders(domain: string): Promise<string[]> {
      if (api) {
        const forwarders = await api.listForwarders!(domain);
        return forwarders.map((forwarder) => forwarder.alias).filter(Boolean);
      }
      return legacy.listForwarders!(credentials as directadmin.DACredentials, domain);
    },
    async getForwarderDestination(domain: string, user: string): Promise<string> {
      if (api) {
        const forwarders = await api.listForwarders!(domain);
        return forwarders.find((forwarder) => forwarder.alias === user)?.destinations.join(',') || '';
      }
      return legacy.getForwarderDestination!(credentials as directadmin.DACredentials, domain, user);
    },
    async createForwarder(domain: string, user: string, destination: string): Promise<any> {
      if (api) {
        const destinations = destination
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        await api.createForwarder!(domain, user, destinations);
        return mutationSuccess;
      }
      return legacy.createForwarder!(credentials as directadmin.DACredentials, domain, user, destination);
    },
    async deleteForwarder(domain: string, user: string): Promise<any> {
      if (api) {
        await api.deleteForwarder!(domain, user);
        return mutationSuccess;
      }
      return legacy.deleteForwarder!(credentials as directadmin.DACredentials, domain, user);
    },
    async getCatchAll(domain: string): Promise<string> {
      if (api) {
        const catchAll = await api.getCatchAll!(domain);
        if (catchAll.type === 'fail') return ':fail:';
        if (catchAll.type === 'blackhole') return ':blackhole:';
        return catchAll.address || '';
      }
      return legacy.getCatchAll!(credentials as directadmin.DACredentials, domain);
    },
    async setCatchAll(domain: string, value: string): Promise<any> {
      if (api) {
        const catchAll =
          value === ':fail:'
            ? { type: 'fail' as const }
            : value === ':blackhole:'
              ? { type: 'blackhole' as const }
              : { type: 'address' as const, address: value };
        await api.updateCatchAll!(domain, catchAll);
        return mutationSuccess;
      }
      return legacy.setCatchAll!(credentials as directadmin.DACredentials, domain, value);
    },
    async listDomainPointers(domain: string): Promise<Record<string, string>> {
      if (api) {
        const pointers = await api.listDomainPointers!(domain);
        return Object.fromEntries(pointers.map((pointer) => [pointer.pointer, pointer.target || domain]));
      }
      return legacy.listDomainPointers!(credentials as directadmin.DACredentials, domain);
    },
    async addDomainPointer(domain: string, pointer: string): Promise<any> {
      if (api) {
        await api.createDomainPointer!(domain, pointer);
        return mutationSuccess;
      }
      return legacy.addDomainPointer!(credentials as directadmin.DACredentials, domain, pointer);
    },
    async deleteDomainPointer(domain: string, pointer: string): Promise<any> {
      if (api) {
        await api.deleteDomainPointer!(domain, pointer);
        return mutationSuccess;
      }
      return legacy.deleteDomainPointer!(credentials as directadmin.DACredentials, domain, pointer);
    },
    async getDkimKey(domain: string): Promise<string | null> {
      if (api) return (await api.getDnsInfo!(domain)).dkim?.value || null;
      return legacy.getDkimKey!(credentials as directadmin.DACredentials, domain);
    },
    async testAuth(): Promise<{ success: boolean; message: string; username?: string }> {
      if (!api) return legacy.testAuth!(credentials as directadmin.DACredentials);
      try {
        await api.listDomains!();
        return { success: true, message: 'Authentication successful', username: credentials.username };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    async getQuotaUsage(): Promise<any> {
      if (api) {
        const [quota, domains] = await Promise.all([api.getQuota!(), api.listDomains!()]);
        let emailAccounts = 0;
        let forwarders = 0;
        for (const domain of domains) {
          const [domainAccounts, domainForwarders] = await Promise.all([
            api.listEmailAccounts!(domain),
            api.listForwarders!(domain),
          ]);
          emailAccounts += domainAccounts.length;
          forwarders += domainForwarders.length;
        }
        const usedMb = Math.round(((quota.total_used || 0) / 1024 / 1024) * 100) / 100;
        return {
          quota: usedMb,
          disk: usedMb,
          bandwidth: 0,
          nemails: emailAccounts,
          email: emailAccounts,
          vdomains: domains.length,
          domains: domains.length,
          nemailf: forwarders,
          forwarders,
        };
      }
      return legacy.getQuotaUsage!(legacyCredentials('full account quota reporting'));
    },
    async getUserConfig(): Promise<any> {
      if (api) {
        const quota = await api.getQuota!();
        const limitMb = Math.round(((quota.total_limit || 0) / 1024 / 1024) * 100) / 100;
        return {
          quota: limitMb,
          disk: limitMb,
          bandwidth: 0,
          nemails: 0,
          vdomains: 0,
          nemailf: 0,
        };
      }
      return legacy.getUserConfig!(legacyCredentials('account resource limits'));
    },
    async getSpamConfig(domain: string): Promise<any> {
      return legacy.getSpamConfig!(legacyCredentials('full SpamAssassin settings'), domain);
    },
    async setSpamConfig(domain: string, settings: Record<string, string>): Promise<any> {
      return legacy.setSpamConfig!(legacyCredentials('full SpamAssassin settings'), domain, settings);
    },
    async listEmailFilters(domain: string, user: string): Promise<any[]> {
      return legacy.listEmailFilters!(legacyCredentials('email filters'), domain, user);
    },
    async createEmailFilter(domain: string, user: string, filterData: Record<string, string>): Promise<any> {
      return legacy.createEmailFilter!(legacyCredentials('email filters'), domain, user, filterData);
    },
    async deleteEmailFilter(domain: string, user: string, filterName: string): Promise<any> {
      return legacy.deleteEmailFilter!(legacyCredentials('email filters'), domain, user, filterName);
    },
    async listAutoresponders(domain: string): Promise<string[]> {
      return legacy.listAutoresponders!(legacyCredentials('autoresponders'), domain);
    },
    async getAutoresponder(domain: string, user: string): Promise<any> {
      return legacy.getAutoresponder!(legacyCredentials('autoresponders'), domain, user);
    },
    async createAutoresponder(domain: string, user: string, text: string, cc?: string): Promise<any> {
      return legacy.createAutoresponder!(legacyCredentials('autoresponders'), domain, user, text, cc);
    },
    async modifyAutoresponder(domain: string, user: string, text: string, cc?: string): Promise<any> {
      return legacy.modifyAutoresponder!(legacyCredentials('autoresponders'), domain, user, text, cc);
    },
    async deleteAutoresponder(domain: string, user: string): Promise<any> {
      return legacy.deleteAutoresponder!(legacyCredentials('autoresponders'), domain, user);
    },
    async listDnsRecords(domain: string): Promise<any> {
      return legacy.listDnsRecords!(legacyCredentials('writable MXroute DNS zones'), domain);
    },
    async addDnsRecord(domain: string, type: string, name: string, value: string, priority?: number): Promise<any> {
      return legacy.addDnsRecord!(legacyCredentials('writable MXroute DNS zones'), domain, type, name, value, priority);
    },
    async deleteDnsRecord(domain: string, type: string, name: string, value: string): Promise<any> {
      return legacy.deleteDnsRecord!(legacyCredentials('writable MXroute DNS zones'), domain, type, name, value);
    },
    async listMailingLists(domain: string): Promise<string[]> {
      return legacy.listMailingLists!(legacyCredentials('mailing lists'), domain);
    },
    async getMailingListMembers(domain: string, name: string): Promise<string[]> {
      return legacy.getMailingListMembers!(legacyCredentials('mailing lists'), domain, name);
    },
    async createMailingList(domain: string, name: string): Promise<any> {
      return legacy.createMailingList!(legacyCredentials('mailing lists'), domain, name);
    },
    async deleteMailingList(domain: string, name: string): Promise<any> {
      return legacy.deleteMailingList!(legacyCredentials('mailing lists'), domain, name);
    },
    async addMailingListMember(domain: string, name: string, email: string): Promise<any> {
      return legacy.addMailingListMember!(legacyCredentials('mailing lists'), domain, name, email);
    },
    async removeMailingListMember(domain: string, name: string, email: string): Promise<any> {
      return legacy.removeMailingListMember!(legacyCredentials('mailing lists'), domain, name, email);
    },
  };
  if (cacheKey) {
    if (defaultApiClients.size >= 20) {
      const oldestKey = defaultApiClients.keys().next().value;
      if (oldestKey) defaultApiClients.delete(oldestKey);
    }
    defaultApiClients.set(cacheKey, client);
  }
  return client;
}

export function listDomains(creds: ManagementCredentials): Promise<string[]> {
  return createManagementClient(creds).listDomains();
}

export function getDomainInfo(creds: ManagementCredentials, domain: string): Promise<any> {
  return createManagementClient(creds).getDomainInfo(domain);
}

export function listEmailAccounts(creds: ManagementCredentials, domain: string): Promise<string[]> {
  return createManagementClient(creds).listEmailAccounts(domain);
}

export function getEmailAccountInfo(creds: ManagementCredentials, domain: string, user: string): Promise<any> {
  return createManagementClient(creds).getEmailAccountInfo(domain, user);
}

export function createEmailAccount(
  creds: ManagementCredentials,
  domain: string,
  user: string,
  password: string,
  quota: number = 0,
): Promise<any> {
  return createManagementClient(creds).createEmailAccount(domain, user, password, quota);
}

export function deleteEmailAccount(creds: ManagementCredentials, domain: string, user: string): Promise<any> {
  return createManagementClient(creds).deleteEmailAccount(domain, user);
}

export function changeEmailPassword(
  creds: ManagementCredentials,
  domain: string,
  user: string,
  password: string,
): Promise<any> {
  return createManagementClient(creds).changeEmailPassword(domain, user, password);
}

export function changeEmailQuota(
  creds: ManagementCredentials,
  domain: string,
  user: string,
  quota: number,
): Promise<any> {
  return createManagementClient(creds).changeEmailQuota(domain, user, quota);
}

export function listForwarders(creds: ManagementCredentials, domain: string): Promise<string[]> {
  return createManagementClient(creds).listForwarders(domain);
}

export function getForwarderDestination(creds: ManagementCredentials, domain: string, user: string): Promise<string> {
  return createManagementClient(creds).getForwarderDestination(domain, user);
}

export function createForwarder(
  creds: ManagementCredentials,
  domain: string,
  user: string,
  destination: string,
): Promise<any> {
  return createManagementClient(creds).createForwarder(domain, user, destination);
}

export function deleteForwarder(creds: ManagementCredentials, domain: string, user: string): Promise<any> {
  return createManagementClient(creds).deleteForwarder(domain, user);
}

export function getCatchAll(creds: ManagementCredentials, domain: string): Promise<string> {
  return createManagementClient(creds).getCatchAll(domain);
}

export function setCatchAll(creds: ManagementCredentials, domain: string, value: string): Promise<any> {
  return createManagementClient(creds).setCatchAll(domain, value);
}

export function getQuotaUsage(creds: ManagementCredentials): Promise<any> {
  return createManagementClient(creds).getQuotaUsage();
}

export function getUserConfig(creds: ManagementCredentials): Promise<any> {
  return createManagementClient(creds).getUserConfig();
}

export function listDomainPointers(creds: ManagementCredentials, domain: string): Promise<Record<string, string>> {
  return createManagementClient(creds).listDomainPointers(domain);
}

export function addDomainPointer(creds: ManagementCredentials, domain: string, pointer: string): Promise<any> {
  return createManagementClient(creds).addDomainPointer(domain, pointer);
}

export function deleteDomainPointer(creds: ManagementCredentials, domain: string, pointer: string): Promise<any> {
  return createManagementClient(creds).deleteDomainPointer(domain, pointer);
}

export function getSpamConfig(creds: ManagementCredentials, domain: string): Promise<any> {
  return createManagementClient(creds).getSpamConfig(domain);
}

export function setSpamConfig(
  creds: ManagementCredentials,
  domain: string,
  settings: Record<string, string>,
): Promise<any> {
  return createManagementClient(creds).setSpamConfig(domain, settings);
}

export function listEmailFilters(creds: ManagementCredentials, domain: string, user: string): Promise<any[]> {
  return createManagementClient(creds).listEmailFilters(domain, user);
}

export function createEmailFilter(
  creds: ManagementCredentials,
  domain: string,
  user: string,
  filterData: Record<string, string>,
): Promise<any> {
  return createManagementClient(creds).createEmailFilter(domain, user, filterData);
}

export function deleteEmailFilter(
  creds: ManagementCredentials,
  domain: string,
  user: string,
  filterName: string,
): Promise<any> {
  return createManagementClient(creds).deleteEmailFilter(domain, user, filterName);
}

export function testAuth(
  creds: ManagementCredentials,
): Promise<{ success: boolean; message: string; username?: string }> {
  return createManagementClient(creds).testAuth();
}

export function listAutoresponders(creds: ManagementCredentials, domain: string): Promise<string[]> {
  return createManagementClient(creds).listAutoresponders(domain);
}

export function getAutoresponder(creds: ManagementCredentials, domain: string, user: string): Promise<any> {
  return createManagementClient(creds).getAutoresponder(domain, user);
}

export function createAutoresponder(
  creds: ManagementCredentials,
  domain: string,
  user: string,
  text: string,
  cc?: string,
): Promise<any> {
  return createManagementClient(creds).createAutoresponder(domain, user, text, cc);
}

export function modifyAutoresponder(
  creds: ManagementCredentials,
  domain: string,
  user: string,
  text: string,
  cc?: string,
): Promise<any> {
  return createManagementClient(creds).modifyAutoresponder(domain, user, text, cc);
}

export function deleteAutoresponder(creds: ManagementCredentials, domain: string, user: string): Promise<any> {
  return createManagementClient(creds).deleteAutoresponder(domain, user);
}

export function listDnsRecords(creds: ManagementCredentials, domain: string): Promise<any> {
  return createManagementClient(creds).listDnsRecords(domain);
}

export function addDnsRecord(
  creds: ManagementCredentials,
  domain: string,
  type: string,
  name: string,
  value: string,
  priority?: number,
): Promise<any> {
  return createManagementClient(creds).addDnsRecord(domain, type, name, value, priority);
}

export function deleteDnsRecord(
  creds: ManagementCredentials,
  domain: string,
  type: string,
  name: string,
  value: string,
): Promise<any> {
  return createManagementClient(creds).deleteDnsRecord(domain, type, name, value);
}

export function getDkimKey(creds: ManagementCredentials, domain: string): Promise<string | null> {
  return createManagementClient(creds).getDkimKey(domain);
}

export function listMailingLists(creds: ManagementCredentials, domain: string): Promise<string[]> {
  return createManagementClient(creds).listMailingLists(domain);
}

export function getMailingListMembers(creds: ManagementCredentials, domain: string, name: string): Promise<string[]> {
  return createManagementClient(creds).getMailingListMembers(domain, name);
}

export function createMailingList(creds: ManagementCredentials, domain: string, name: string): Promise<any> {
  return createManagementClient(creds).createMailingList(domain, name);
}

export function deleteMailingList(creds: ManagementCredentials, domain: string, name: string): Promise<any> {
  return createManagementClient(creds).deleteMailingList(domain, name);
}

export function addMailingListMember(
  creds: ManagementCredentials,
  domain: string,
  name: string,
  email: string,
): Promise<any> {
  return createManagementClient(creds).addMailingListMember(domain, name, email);
}

export function removeMailingListMember(
  creds: ManagementCredentials,
  domain: string,
  name: string,
  email: string,
): Promise<any> {
  return createManagementClient(creds).removeMailingListMember(domain, name, email);
}
