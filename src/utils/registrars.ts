import fetch from 'node-fetch';

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  priority?: number;
  ttl?: number;
}

export interface RegistrarConfig {
  provider: string;
  apiKey: string;
  apiSecret?: string;
  accountId?: string;
}

export interface RegistrarProvider {
  name: string;
  id: string;
  authenticate(config: RegistrarConfig): Promise<boolean>;
  listZones(config: RegistrarConfig): Promise<string[]>;
  listRecords(config: RegistrarConfig, domain: string): Promise<DnsRecord[]>;
  createRecord(
    config: RegistrarConfig,
    domain: string,
    record: DnsRecord,
  ): Promise<{ success: boolean; message: string }>;
  deleteRecord(
    config: RegistrarConfig,
    domain: string,
    record: DnsRecord,
  ): Promise<{ success: boolean; message: string }>;
}

// ─── Cloudflare ──────────────────────────────────────────

const cloudflare: RegistrarProvider = {
  name: 'Cloudflare',
  id: 'cloudflare',

  async authenticate(config) {
    try {
      const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      const data = (await res.json()) as any;
      return data.success === true;
    } catch {
      return false;
    }
  },

  async listZones(config) {
    const res = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const data = (await res.json()) as any;
    if (!data.success) throw new Error(data.errors?.[0]?.message || 'Failed to list zones');
    return data.result.map((z: any) => z.name);
  },

  async listRecords(config, domain) {
    const zoneId = await getCloudflareZoneId(config.apiKey, domain);
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
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

  async createRecord(config, domain, record) {
    const zoneId = await getCloudflareZoneId(config.apiKey, domain);
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
        Authorization: `Bearer ${config.apiKey}`,
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

  async deleteRecord(config, domain, record) {
    const zoneId = await getCloudflareZoneId(config.apiKey, domain);
    // Find the record ID first
    const name = record.name === '@' ? domain : `${record.name}.${domain}`;
    const searchRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=${record.type}&name=${name}`,
      { headers: { Authorization: `Bearer ${config.apiKey}` } },
    );
    const searchData = (await searchRes.json()) as any;
    if (!searchData.success || !searchData.result.length) {
      return { success: false, message: 'Record not found' };
    }
    const recordId = searchData.result[0].id;
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const data = (await res.json()) as any;
    return { success: data.success, message: data.success ? 'Deleted' : data.errors?.[0]?.message || 'Failed' };
  },
};

async function getCloudflareZoneId(apiKey: string, domain: string): Promise<string> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = (await res.json()) as any;
  if (!data.success || !data.result.length) throw new Error(`Zone not found for ${domain}`);
  return data.result[0].id;
}

// ─── Porkbun ─────────────────────────────────────────────

const porkbun: RegistrarProvider = {
  name: 'Porkbun',
  id: 'porkbun',

  async authenticate(config) {
    try {
      const res = await fetch('https://api.porkbun.com/api/json/v3/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: config.apiKey, secretapikey: config.apiSecret }),
      });
      const data = (await res.json()) as any;
      return data.status === 'SUCCESS';
    } catch {
      return false;
    }
  },

  async listZones(config) {
    const res = await fetch('https://api.porkbun.com/api/json/v3/domain/listAll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: config.apiKey, secretapikey: config.apiSecret }),
    });
    const data = (await res.json()) as any;
    if (data.status !== 'SUCCESS') throw new Error(data.message || 'Failed');
    return (data.domains || []).map((d: any) => d.domain);
  },

  async listRecords(config, domain) {
    const res = await fetch(`https://api.porkbun.com/api/json/v3/dns/retrieve/${domain}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: config.apiKey, secretapikey: config.apiSecret }),
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

  async createRecord(config, domain, record) {
    const body: any = {
      apikey: config.apiKey,
      secretapikey: config.apiSecret,
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

  async deleteRecord(config, domain, record) {
    const name = record.name === '@' ? '' : record.name;
    const res = await fetch(
      `https://api.porkbun.com/api/json/v3/dns/deleteByNameType/${domain}/${record.type}/${name}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: config.apiKey, secretapikey: config.apiSecret }),
      },
    );
    const data = (await res.json()) as any;
    return {
      success: data.status === 'SUCCESS',
      message: data.status === 'SUCCESS' ? 'Deleted' : data.message || 'Failed',
    };
  },
};

// ─── DigitalOcean ────────────────────────────────────────

const digitalocean: RegistrarProvider = {
  name: 'DigitalOcean',
  id: 'digitalocean',

  async authenticate(config) {
    try {
      const res = await fetch('https://api.digitalocean.com/v2/account', {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async listZones(config) {
    const res = await fetch('https://api.digitalocean.com/v2/domains?per_page=200', {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const data = (await res.json()) as any;
    return (data.domains || []).map((d: any) => d.name);
  },

  async listRecords(config, domain) {
    const res = await fetch(`https://api.digitalocean.com/v2/domains/${domain}/records?per_page=200`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
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

  async createRecord(config, domain, record) {
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
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return { success: true, message: `Created ${record.type} record` };
    const data = (await res.json()) as any;
    return { success: false, message: data.message || 'Failed' };
  },

  async deleteRecord(config, domain, record) {
    // List and find record ID
    const listRes = await fetch(`https://api.digitalocean.com/v2/domains/${domain}/records?per_page=200`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const listData = (await listRes.json()) as any;
    const match = (listData.domain_records || []).find((r: any) => r.type === record.type && r.name === record.name);
    if (!match) return { success: false, message: 'Record not found' };

    const res = await fetch(`https://api.digitalocean.com/v2/domains/${domain}/records/${match.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    return { success: res.ok, message: res.ok ? 'Deleted' : 'Failed' };
  },
};

// ─── Namecheap ───────────────────────────────────────────

const namecheap: RegistrarProvider = {
  name: 'Namecheap',
  id: 'namecheap',

  async authenticate(config) {
    try {
      // Namecheap API requires IP whitelisting, so we just verify the key format
      return !!(config.apiKey && config.apiSecret);
    } catch {
      return false;
    }
  },

  async listZones(config) {
    const url = `https://api.namecheap.com/xml.response?ApiUser=${config.apiSecret}&ApiKey=${config.apiKey}&UserName=${config.apiSecret}&ClientIp=0.0.0.0&Command=namecheap.domains.getList`;
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

  async listRecords() {
    return []; // Namecheap doesn't have a simple record list API
  },

  async createRecord() {
    return {
      success: false,
      message:
        'Namecheap requires setting ALL records at once via their API. Use their web panel or switch DNS to Cloudflare for API management.',
    };
  },

  async deleteRecord() {
    return { success: false, message: 'Namecheap requires setting ALL records at once. Use their web panel.' };
  },
};

// ─── Provider Registry ───────────────────────────────────

export const registrarProviders: Record<string, RegistrarProvider> = {
  cloudflare,
  porkbun,
  digitalocean,
  namecheap,
};

export function getProvider(id: string): RegistrarProvider | undefined {
  return registrarProviders[id];
}

export function getProviderList(): { name: string; id: string }[] {
  return Object.values(registrarProviders).map((p) => ({ name: p.name, id: p.id }));
}

// ─── MXroute Records Generator ──────────────────────────

export function generateMxrouteRecords(server: string, domain: string, dkimKey?: string): DnsRecord[] {
  const records: DnsRecord[] = [
    { type: 'MX', name: '@', value: `${server}.mxrouting.net`, priority: 10, ttl: 3600 },
    { type: 'MX', name: '@', value: `${server}-relay.mxrouting.net`, priority: 20, ttl: 3600 },
    { type: 'TXT', name: '@', value: 'v=spf1 include:mxroute.com -all', ttl: 3600 },
    { type: 'TXT', name: '_dmarc', value: `v=DMARC1; p=quarantine; rua=mailto:postmaster@${domain}`, ttl: 3600 },
  ];

  if (dkimKey) {
    records.push({ type: 'TXT', name: 'x._domainkey', value: dkimKey, ttl: 3600 });
  }

  return records;
}
