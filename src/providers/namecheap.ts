import fetch from 'node-fetch';
import { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult } from './types';

export const namecheap: DnsProvider = {
  id: 'namecheap',
  name: 'Namecheap',
  nsPatterns: ['registrar-servers.com', 'namecheaphosting.com'],
  credentialFields: [
    { name: 'apiKey', label: 'API Key', secret: true },
    { name: 'apiSecret', label: 'API Username', secret: false },
  ],

  validateCredentials(creds: ProviderCredentials): string | null {
    if (!creds.apiKey || creds.apiKey.trim() === '') {
      return 'API Key is required';
    }
    if (!creds.apiSecret || creds.apiSecret.trim() === '') {
      return 'API Username is required';
    }
    return null;
  },

  async authenticate(creds: ProviderCredentials): Promise<boolean> {
    try {
      return !!(creds.apiKey && creds.apiSecret);
    } catch {
      return false;
    }
  },

  async listZones(creds: ProviderCredentials): Promise<string[]> {
    const url = `https://api.namecheap.com/xml.response?ApiUser=${creds.apiSecret}&ApiKey=${creds.apiKey}&UserName=${creds.apiSecret}&ClientIp=0.0.0.0&Command=namecheap.domains.getList`;
    const res = await fetch(url);
    const text = await res.text();
    const domains: string[] = [];
    const regex = /Name="([^"]+)"/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      domains.push(match[1]);
    }
    return domains;
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
