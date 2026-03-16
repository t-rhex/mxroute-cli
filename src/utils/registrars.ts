// Deprecated — use src/providers/ instead
import { ProviderCredentials } from '../providers/types';
export { getProvider, listProviders as getProviderList } from '../providers';
export { DnsRecord } from '../providers/types';
export { generateMxrouteRecords } from '../providers/mxroute-records';

export interface RegistrarConfig extends ProviderCredentials {
  provider: string;
  apiKey: string;
  apiSecret?: string;
  accountId?: string;
}
