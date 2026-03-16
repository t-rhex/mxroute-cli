import { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult } from './types';

const DETECTION_MESSAGE =
  'Route53 requires AWS SDK. Use: aws route53 change-resource-record-sets or install @aws-sdk/client-route-53';

export const route53: DnsProvider = {
  id: 'route53',
  name: 'AWS Route53',
  nsPatterns: ['awsdns'],
  credentialFields: [
    { name: 'apiKey', label: 'Access Key ID', secret: false },
    { name: 'apiSecret', label: 'Secret Access Key', secret: true },
    { name: 'region', label: 'AWS Region (e.g., us-east-1)', secret: false },
  ],

  validateCredentials(creds: ProviderCredentials): string | null {
    if (!creds.apiKey || creds.apiKey.trim() === '') {
      return 'Access Key ID is required';
    }
    if (!creds.apiSecret || creds.apiSecret.trim() === '') {
      return 'Secret Access Key is required';
    }
    if (!creds.region || creds.region.trim() === '') {
      return 'AWS Region is required';
    }
    return null;
  },

  async authenticate(_creds: ProviderCredentials): Promise<boolean> {
    return true;
  },

  async listZones(_creds: ProviderCredentials): Promise<string[]> {
    return [];
  },

  async listRecords(_creds: ProviderCredentials, _domain: string): Promise<DnsRecord[]> {
    return [];
  },

  async createRecord(_creds: ProviderCredentials, _domain: string, _record: DnsRecord): Promise<ProviderResult> {
    return { success: false, message: DETECTION_MESSAGE };
  },

  async deleteRecord(_creds: ProviderCredentials, _domain: string, _record: DnsRecord): Promise<ProviderResult> {
    return { success: false, message: 'Route53 requires AWS SDK.' };
  },
};
