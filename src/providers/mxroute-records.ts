import { DnsRecord } from './types';

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
