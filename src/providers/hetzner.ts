import fetch from 'node-fetch';
import { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult } from './types';

const API_BASE = 'https://dns.hetzner.com/api/v1';

function authHeaders(creds: ProviderCredentials): Record<string, string> {
  return {
    'Auth-API-Token': creds.apiKey!,
    'Content-Type': 'application/json',
  };
}

async function getZoneId(creds: ProviderCredentials, domain: string): Promise<string> {
  const res = await fetch(`${API_BASE}/zones?name=${encodeURIComponent(domain)}`, {
    headers: authHeaders(creds),
  });
  const data = (await res.json()) as any;
  if (!data.zones || !data.zones.length) throw new Error(`Zone not found for ${domain}`);
  return data.zones[0].id;
}

export const hetzner: DnsProvider = {
  id: 'hetzner',
  name: 'Hetzner DNS',
  nsPatterns: ['hetzner.com', 'hetzner.de', 'second-ns.com', 'second-ns.de'],
  credentialFields: [{ name: 'apiKey', label: 'API Token', secret: true }],

  validateCredentials(creds: ProviderCredentials): string | null {
    if (!creds.apiKey || creds.apiKey.trim() === '') {
      return 'API Token is required';
    }
    return null;
  },

  async authenticate(creds: ProviderCredentials): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/zones?per_page=1`, {
        headers: authHeaders(creds),
      });
      return res.status === 200;
    } catch {
      return false;
    }
  },

  async listZones(creds: ProviderCredentials): Promise<string[]> {
    const res = await fetch(`${API_BASE}/zones`, {
      headers: authHeaders(creds),
    });
    const data = (await res.json()) as any;
    if (!data.zones) throw new Error(data.message || 'Failed to list zones');
    return data.zones.map((z: any) => z.name);
  },

  async listRecords(creds: ProviderCredentials, domain: string): Promise<DnsRecord[]> {
    const zoneId = await getZoneId(creds, domain);
    const res = await fetch(`${API_BASE}/records?zone_id=${zoneId}`, {
      headers: authHeaders(creds),
    });
    const data = (await res.json()) as any;
    if (!data.records) throw new Error(data.message || 'Failed to list records');
    return data.records.map((r: any) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      value: r.value,
      ttl: r.ttl,
    }));
  },

  async createRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    const zoneId = await getZoneId(creds, domain);
    const body: any = {
      zone_id: zoneId,
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: record.ttl || 3600,
    };
    if (record.type === 'MX' && record.priority !== undefined) body.priority = record.priority;

    const res = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: authHeaders(creds),
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as any;
    if (data.record) {
      return { success: true, message: `Created ${record.type} record: ${record.name}` };
    }
    return { success: false, message: data.message || 'Failed to create record' };
  },

  async deleteRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    const zoneId = await getZoneId(creds, domain);

    // Find the record ID by listing records
    const listRes = await fetch(`${API_BASE}/records?zone_id=${zoneId}`, {
      headers: authHeaders(creds),
    });
    const listData = (await listRes.json()) as any;
    if (!listData.records) {
      return { success: false, message: 'Failed to list records for deletion' };
    }

    const match = listData.records.find(
      (r: any) => r.type === record.type && r.name === record.name && r.value === record.value,
    );
    if (!match) {
      return { success: false, message: 'Record not found' };
    }

    const res = await fetch(`${API_BASE}/records/${match.id}`, {
      method: 'DELETE',
      headers: authHeaders(creds),
    });

    if (res.status === 200 || res.status === 204) {
      return { success: true, message: 'Deleted' };
    }
    const data = (await res.json()) as any;
    return { success: false, message: data.message || 'Failed to delete record' };
  },
};
