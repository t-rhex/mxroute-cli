import fetch from 'node-fetch';
import { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult } from './types';

export const digitalocean: DnsProvider = {
  id: 'digitalocean',
  name: 'DigitalOcean',
  nsPatterns: ['digitalocean.com'],
  credentialFields: [{ name: 'apiKey', label: 'API Token', secret: true }],

  validateCredentials(creds: ProviderCredentials): string | null {
    if (!creds.apiKey || creds.apiKey.trim() === '') {
      return 'API Token is required';
    }
    return null;
  },

  async authenticate(creds: ProviderCredentials): Promise<boolean> {
    try {
      const res = await fetch('https://api.digitalocean.com/v2/account', {
        headers: { Authorization: `Bearer ${creds.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async listZones(creds: ProviderCredentials): Promise<string[]> {
    const res = await fetch('https://api.digitalocean.com/v2/domains?per_page=200', {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const data = (await res.json()) as any;
    return (data.domains || []).map((d: any) => d.name);
  },

  async listRecords(creds: ProviderCredentials, domain: string): Promise<DnsRecord[]> {
    const res = await fetch(`https://api.digitalocean.com/v2/domains/${domain}/records?per_page=200`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const data = (await res.json()) as any;
    return (data.domain_records || []).map((r: any) => ({
      type: r.type,
      name: r.name === '@' ? '@' : r.name,
      value: r.data,
      priority: r.priority,
      ttl: r.ttl,
    }));
  },

  async createRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    const body: any = {
      type: record.type,
      name: record.name,
      data: record.value,
      ttl: record.ttl || 3600,
    };
    if (record.priority !== undefined) body.priority = record.priority;

    const res = await fetch(`https://api.digitalocean.com/v2/domains/${domain}/records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return { success: true, message: `Created ${record.type} record` };
    const data = (await res.json()) as any;
    return { success: false, message: data.message || 'Failed' };
  },

  async deleteRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    const listRes = await fetch(`https://api.digitalocean.com/v2/domains/${domain}/records?per_page=200`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const listData = (await listRes.json()) as any;
    const match = (listData.domain_records || []).find(
      (r: any) => r.type === record.type && r.name === record.name && r.data === record.value,
    );
    if (!match) return { success: false, message: 'Record not found' };

    const res = await fetch(`https://api.digitalocean.com/v2/domains/${domain}/records/${match.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    return { success: res.ok, message: res.ok ? 'Deleted' : 'Failed' };
  },
};
