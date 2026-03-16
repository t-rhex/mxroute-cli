import fetch from 'node-fetch';
import { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult } from './types';

const API_BASE = 'https://api.godaddy.com/v1';

function authHeader(creds: ProviderCredentials): string {
  return `sso-key ${creds.apiKey}:${creds.apiSecret}`;
}

export const godaddy: DnsProvider = {
  id: 'godaddy',
  name: 'GoDaddy',
  nsPatterns: ['domaincontrol.com', 'godaddy.com'],
  credentialFields: [
    { name: 'apiKey', label: 'API Key', secret: true },
    { name: 'apiSecret', label: 'API Secret', secret: true },
  ],

  validateCredentials(creds: ProviderCredentials): string | null {
    if (!creds.apiKey || creds.apiKey.trim() === '') {
      return 'API Key is required';
    }
    if (!creds.apiSecret || creds.apiSecret.trim() === '') {
      return 'API Secret is required';
    }
    return null;
  },

  async authenticate(creds: ProviderCredentials): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/domains?limit=1`, {
        headers: { Authorization: authHeader(creds) },
      });
      return res.status === 200;
    } catch {
      return false;
    }
  },

  async listZones(creds: ProviderCredentials): Promise<string[]> {
    const res = await fetch(`${API_BASE}/domains`, {
      headers: { Authorization: authHeader(creds) },
    });
    const data = (await res.json()) as any;
    if (!Array.isArray(data)) throw new Error(data.message || 'Failed to list domains');
    return data.map((d: any) => d.domain);
  },

  async listRecords(creds: ProviderCredentials, domain: string): Promise<DnsRecord[]> {
    const res = await fetch(`${API_BASE}/domains/${domain}/records`, {
      headers: { Authorization: authHeader(creds) },
    });
    const data = (await res.json()) as any;
    if (!Array.isArray(data)) throw new Error(data.message || 'Failed to list records');
    return data.map((r: any) => ({
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

    const res = await fetch(`${API_BASE}/domains/${domain}/records`, {
      method: 'PATCH',
      headers: {
        Authorization: authHeader(creds),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([body]),
    });

    if (res.status === 200 || res.status === 204) {
      return { success: true, message: `Created ${record.type} record: ${record.name}` };
    }
    const data = (await res.json()) as any;
    return { success: false, message: data.message || 'Failed to create record' };
  },

  async deleteRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    // GET all records of the same type/name
    const getRes = await fetch(`${API_BASE}/domains/${domain}/records/${record.type}/${record.name}`, {
      headers: { Authorization: authHeader(creds) },
    });

    if (!getRes.ok) {
      const data = (await getRes.json()) as any;
      return { success: false, message: data.message || 'Failed to fetch records for deletion' };
    }

    const existing = (await getRes.json()) as any[];

    if (!Array.isArray(existing) || existing.length === 0) {
      return { success: false, message: 'Record not found' };
    }

    // Filter out the record matching the target value
    const remaining = existing.filter((r: any) => r.data !== record.value);

    // If only one record existed, use DELETE to remove the whole set
    if (existing.length === 1 || remaining.length === 0) {
      const res = await fetch(`${API_BASE}/domains/${domain}/records/${record.type}/${record.name}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader(creds) },
      });
      if (res.status === 204 || res.status === 200) {
        return { success: true, message: 'Deleted' };
      }
      const data = (await res.json()) as any;
      return { success: false, message: data.message || 'Failed to delete record' };
    }

    // PUT the remaining records back (preserving others)
    const putRes = await fetch(`${API_BASE}/domains/${domain}/records/${record.type}/${record.name}`, {
      method: 'PUT',
      headers: {
        Authorization: authHeader(creds),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(remaining),
    });

    if (putRes.status === 200 || putRes.status === 204) {
      return { success: true, message: 'Deleted' };
    }
    const data = (await putRes.json()) as any;
    return { success: false, message: data.message || 'Failed to delete record' };
  },
};
