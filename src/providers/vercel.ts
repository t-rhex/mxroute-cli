import fetch from 'node-fetch';
import { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult } from './types';

const API_BASE = 'https://api.vercel.com';

function authHeaders(creds: ProviderCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${creds.apiKey}`,
    'Content-Type': 'application/json',
  };
}

export const vercel: DnsProvider = {
  id: 'vercel',
  name: 'Vercel DNS',
  nsPatterns: ['vercel-dns.com'],
  credentialFields: [{ name: 'apiKey', label: 'Bearer Token', secret: true }],

  validateCredentials(creds: ProviderCredentials): string | null {
    if (!creds.apiKey || creds.apiKey.trim() === '') {
      return 'Bearer Token is required';
    }
    return null;
  },

  async authenticate(creds: ProviderCredentials): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/v5/domains?limit=1`, {
        headers: authHeaders(creds),
      });
      return res.status === 200;
    } catch {
      return false;
    }
  },

  async listZones(creds: ProviderCredentials): Promise<string[]> {
    const res = await fetch(`${API_BASE}/v5/domains`, {
      headers: authHeaders(creds),
    });
    const data = (await res.json()) as any;
    if (!data.domains) throw new Error(data.error?.message || 'Failed to list domains');
    return data.domains.map((d: any) => d.name);
  },

  async listRecords(creds: ProviderCredentials, domain: string): Promise<DnsRecord[]> {
    const res = await fetch(`${API_BASE}/v4/domains/${domain}/records`, {
      headers: authHeaders(creds),
    });
    const data = (await res.json()) as any;
    if (!data.records) throw new Error(data.error?.message || 'Failed to list records');
    return data.records.map((r: any) => ({
      id: r.id,
      type: r.type,
      name: r.name || '@',
      value: r.value,
      priority: r.mxPriority,
      ttl: r.ttl,
    }));
  },

  async createRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    const body: any = {
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: record.ttl || 3600,
    };
    if (record.priority !== undefined) body.mxPriority = record.priority;

    const res = await fetch(`${API_BASE}/v2/domains/${domain}/records`, {
      method: 'POST',
      headers: authHeaders(creds),
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as any;
    if (data.uid || res.status === 200 || res.status === 201) {
      return { success: true, message: `Created ${record.type} record: ${record.name}` };
    }
    return { success: false, message: data.error?.message || 'Failed to create record' };
  },

  async deleteRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    // Find the record ID by listing records
    const listRes = await fetch(`${API_BASE}/v4/domains/${domain}/records`, {
      headers: authHeaders(creds),
    });
    const listData = (await listRes.json()) as any;
    if (!listData.records) {
      return { success: false, message: 'Failed to list records for deletion' };
    }

    const match = listData.records.find(
      (r: any) => r.type === record.type && (r.name || '@') === record.name && r.value === record.value,
    );
    if (!match) {
      return { success: false, message: 'Record not found' };
    }

    const res = await fetch(`${API_BASE}/v2/domains/${domain}/records/${match.id}`, {
      method: 'DELETE',
      headers: authHeaders(creds),
    });

    if (res.status === 200 || res.status === 204) {
      return { success: true, message: 'Deleted' };
    }
    const data = (await res.json()) as any;
    return { success: false, message: data.error?.message || 'Failed to delete record' };
  },
};
