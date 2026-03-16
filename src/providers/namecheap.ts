import { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult } from './types';

export const namecheap: DnsProvider = {
  id: 'namecheap',
  name: 'Namecheap',
  nsPatterns: ['registrar-servers.com', 'namecheaphosting.com'],
  detectionOnly: true,
  credentialFields: [
    { name: 'apiKey', label: 'API Key', secret: true },
    // Field named 'username' (previously 'apiSecret'); renamed for clarity.
    // Namecheap is detection-only so no saved creds exist to break.
    { name: 'username', label: 'API Username', secret: false },
  ],

  validateCredentials(creds: ProviderCredentials): string | null {
    if (!creds.apiKey || creds.apiKey.trim() === '') {
      return 'API Key is required';
    }
    if (!creds.username || creds.username.trim() === '') {
      return 'API Username is required';
    }
    return null;
  },

  async authenticate(_creds: ProviderCredentials): Promise<boolean> {
    return false;
  },

  async listZones(_creds: ProviderCredentials): Promise<string[]> {
    return [];
  },

  async listRecords(_creds: ProviderCredentials, _domain: string): Promise<DnsRecord[]> {
    return [];
  },

  async createRecord(_creds: ProviderCredentials, _domain: string, _record: DnsRecord): Promise<ProviderResult> {
    return {
      success: false,
      message: 'Namecheap requires setting ALL records atomically. Use their web panel or switch DNS to Cloudflare.',
    };
  },

  async deleteRecord(_creds: ProviderCredentials, _domain: string, _record: DnsRecord): Promise<ProviderResult> {
    return {
      success: false,
      message: 'Namecheap requires setting ALL records atomically. Use their web panel or switch DNS to Cloudflare.',
    };
  },
};
