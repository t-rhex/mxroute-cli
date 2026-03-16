import fetch from 'node-fetch';
import { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult } from './types';

export const porkbun: DnsProvider = {
  id: 'porkbun',
  name: 'Porkbun',
  nsPatterns: ['porkbun.com'],
  credentialFields: [
    { name: 'apiKey', label: 'API Key', secret: true },
    { name: 'apiSecret', label: 'API Secret Key', secret: true },
  ],

  validateCredentials(creds: ProviderCredentials): string | null {
    if (!creds.apiKey || creds.apiKey.trim() === '') {
      return 'API Key is required';
    }
    if (!creds.apiSecret || creds.apiSecret.trim() === '') {
      return 'API Secret Key is required';
    }
    return null;
  },

  async authenticate(creds: ProviderCredentials): Promise<boolean> {
    try {
      const res = await fetch('https://api.porkbun.com/api/json/v3/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: creds.apiKey, secretapikey: creds.apiSecret }),
      });
      const data = (await res.json()) as any;
      return data.status === 'SUCCESS';
    } catch {
      return false;
    }
  },

  async listZones(creds: ProviderCredentials): Promise<string[]> {
    const res = await fetch('https://api.porkbun.com/api/json/v3/domain/listAll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: creds.apiKey, secretapikey: creds.apiSecret }),
    });
    const data = (await res.json()) as any;
    if (data.status !== 'SUCCESS') throw new Error(data.message || 'Failed');
    return (data.domains || []).map((d: any) => d.domain);
  },

  async listRecords(creds: ProviderCredentials, domain: string): Promise<DnsRecord[]> {
    const res = await fetch(`https://api.porkbun.com/api/json/v3/dns/retrieve/${domain}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: creds.apiKey, secretapikey: creds.apiSecret }),
    });
    const data = (await res.json()) as any;
    if (data.status !== 'SUCCESS') throw new Error(data.message || 'Failed');
    return (data.records || []).map((r: any) => ({
      type: r.type,
      name: r.name.replace(`.${domain}`, '').replace(domain, '@') || '@',
      value: r.content,
      priority: r.prio ? Number(r.prio) : undefined,
      ttl: r.ttl ? Number(r.ttl) : undefined,
    }));
  },

  async createRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    const body: any = {
      apikey: creds.apiKey,
      secretapikey: creds.apiSecret,
      type: record.type,
      name: record.name === '@' ? '' : record.name,
      content: record.value,
      ttl: String(record.ttl || 3600),
    };
    if (record.priority !== undefined) body.prio = String(record.priority);

    const res = await fetch(`https://api.porkbun.com/api/json/v3/dns/create/${domain}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as any;
    return {
      success: data.status === 'SUCCESS',
      message: data.status === 'SUCCESS' ? `Created ${record.type} record` : data.message || 'Failed',
    };
  },

  async deleteRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult> {
    const name = record.name === '@' ? '' : record.name;
    const res = await fetch(
      `https://api.porkbun.com/api/json/v3/dns/deleteByNameType/${domain}/${record.type}/${name}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: creds.apiKey, secretapikey: creds.apiSecret }),
      },
    );
    const data = (await res.json()) as any;
    return {
      success: data.status === 'SUCCESS',
      message: data.status === 'SUCCESS' ? 'Deleted' : data.message || 'Failed',
    };
  },
};
