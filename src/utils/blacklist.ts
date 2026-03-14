import { Resolver } from 'dns';
import { promisify } from 'util';

const resolver = new Resolver();
const resolve4 = promisify(resolver.resolve4.bind(resolver));

export interface BlacklistResult {
  list: string;
  listed: boolean;
  response?: string;
}

// Major DNS blacklists
const BLACKLISTS = [
  { name: 'Spamhaus ZEN', zone: 'zen.spamhaus.org' },
  { name: 'Barracuda', zone: 'b.barracudacentral.org' },
  { name: 'SpamCop', zone: 'bl.spamcop.net' },
  { name: 'SORBS', zone: 'dnsbl.sorbs.net' },
  { name: 'CBL', zone: 'cbl.abuseat.org' },
  { name: 'UCEPROTECT L1', zone: 'dnsbl-1.uceprotect.net' },
  { name: 'Invaluement', zone: 'dnsbl.invaluement.com' },
  { name: 'Truncate', zone: 'truncate.gbudb.net' },
  { name: 'PSBL', zone: 'psbl.surriel.com' },
  { name: 'JustSpam', zone: 'dnsbl.justspam.org' },
];

function reverseIp(ip: string): string {
  return ip.split('.').reverse().join('.');
}

export async function resolveServerIp(hostname: string): Promise<string> {
  try {
    const addresses = await resolve4(hostname);
    return addresses[0];
  } catch (err: any) {
    throw new Error(`Could not resolve ${hostname}: ${err.message}`);
  }
}

export async function checkBlacklist(ip: string, list: { name: string; zone: string }): Promise<BlacklistResult> {
  const reversed = reverseIp(ip);
  const query = `${reversed}.${list.zone}`;

  try {
    const addresses = await resolve4(query);
    // If we get a response, the IP is listed
    return {
      list: list.name,
      listed: true,
      response: addresses[0],
    };
  } catch {
    // NXDOMAIN = not listed (this is good)
    return {
      list: list.name,
      listed: false,
    };
  }
}

export async function checkAllBlacklists(ip: string): Promise<BlacklistResult[]> {
  const results = await Promise.all(BLACKLISTS.map((list) => checkBlacklist(ip, list)));
  return results;
}

export function getBlacklistCount(): number {
  return BLACKLISTS.length;
}

export { BLACKLISTS };
