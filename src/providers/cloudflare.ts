import fetch from 'node-fetch';
import { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult } from './types';

async function getCloudflareZoneId(apiKey: string, domain: string): Promise<string> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = (await res.json()) as any;
  if (!data.success || !data.result.length) throw new Error(`Zone not found for ${domain}`);
  return data.result[0].id;
}

export const cloudflare: DnsProvider = {
  id: 'cloudflare',
  name: 'Cloudflare',
  nsPatterns: ['cloudflare.com'],
  credentialFields: [{ name: 'apiKey', label: 'API Token', secret: true }],

  validateCredentials(creds: ProviderCredentials): string | null {
    if (!creds.apiKey || creds.apiKey.trim() === '') {
      return 'API Token is required';
    }
    return null;
  },

  async authenticate(creds: ProviderCredentials): Promise<boolean> {
    try {
      const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: { Authorization: `Bearer ${creds.apiKey}` },
      });
      const data = (await res.json()) as any;
      return data.success === true;
    } catch {
      return false;
    }
  },

  async listZones(creds: ProviderCredentials): Promise<string[]> {
    const res = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const data = (await res.json()) as any;
    if (!data.success) throw new Error(data.errors?.[0]?.message || 'Failed to list zones');
    return data.result.map((z: any) => z.name);
  },

  async listRecords(creds: ProviderCredentials, domain: string): Promise<DnsRecord[]> {
    const zoneId = await getCloudflareZoneId(creds.apiKey!, domain);
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const data = (await res.json()) as any;
    if (!data.success) throw new Error(data.errors?.[0]?.message || 'Failed to list records');
    return data.result.map((r: any) => ({
      type: r.type,
      name: r.name.replace(`.${domain}`, '').replace(domain, '@'),
      value: r.content,
      priority: r.priority,
      ttl: r.ttl,
    }));
  },

  async createRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    const zoneId = await getCloudflareZoneId(creds.apiKey!, domain);
    const name = record.name === '@' ? domain : `${record.name}.${domain}`;
    const body: any = {
      type: record.type,
      name,
      content: record.value,
      ttl: record.ttl || 3600,
      proxied: false,
    };
    if (record.priority !== undefined) body.priority = record.priority;

    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as any;
    if (data.success) {
      return { success: true, message: `Created ${record.type} record: ${record.name}` };
    }
    return { success: false, message: data.errors?.[0]?.message || 'Failed to create record' };
  },

  async deleteRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    const zoneId = await getCloudflareZoneId(creds.apiKey!, domain);
    const name = record.name === '@' ? domain : `${record.name}.${domain}`;
    const searchRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=${record.type}&name=${name}`,
      { headers: { Authorization: `Bearer ${creds.apiKey}` } },
    );
    const searchData = (await searchRes.json()) as any;
    if (!searchData.success || !searchData.result.length) {
      return { success: false, message: 'Record not found' };
    }
    const recordId = searchData.result[0].id;
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const data = (await res.json()) as any;
    return { success: data.success, message: data.success ? 'Deleted' : data.errors?.[0]?.message || 'Failed' };
  },
};
