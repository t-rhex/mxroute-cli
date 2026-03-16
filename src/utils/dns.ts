import { Resolver } from 'dns';
import { promisify } from 'util';

const resolver = new Resolver();

const resolveMx = promisify(resolver.resolveMx.bind(resolver));
const resolveTxt = promisify(resolver.resolveTxt.bind(resolver));
const resolveCname = promisify(resolver.resolveCname.bind(resolver));

export interface DnsCheckResult {
  type: string;
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'info';
  expected: string;
  actual: string;
  message: string;
}

export async function checkMxRecords(domain: string, server: string): Promise<DnsCheckResult> {
  try {
    const records = await resolveMx(domain);
    const primaryExpected = `${server}.mxrouting.net`;
    const relayExpected = `${server}-relay.mxrouting.net`;

    const hasPrimary = records.some((r) => r.exchange.toLowerCase() === primaryExpected.toLowerCase());
    const hasRelay = records.some((r) => r.exchange.toLowerCase() === relayExpected.toLowerCase());

    const actual = records.map((r) => `${r.priority} ${r.exchange}`).join(', ');

    if (hasPrimary && hasRelay) {
      return {
        type: 'MX',
        name: domain,
        status: 'pass',
        expected: `${primaryExpected} + ${relayExpected}`,
        actual,
        message: 'MX records configured correctly',
      };
    } else if (hasPrimary) {
      return {
        type: 'MX',
        name: domain,
        status: 'warn',
        expected: `${primaryExpected} + ${relayExpected}`,
        actual,
        message: 'Primary MX found but relay MX is missing',
      };
    } else {
      return {
        type: 'MX',
        name: domain,
        status: 'fail',
        expected: primaryExpected,
        actual: actual || 'No MX records',
        message: 'MX records not pointing to MXroute',
      };
    }
  } catch (err: any) {
    return {
      type: 'MX',
      name: domain,
      status: 'fail',
      expected: `${server}.mxrouting.net`,
      actual: 'DNS lookup failed',
      message: err.message,
    };
  }
}

export async function checkSpfRecord(domain: string): Promise<DnsCheckResult> {
  try {
    const records = await resolveTxt(domain);
    const flat = records.map((r) => r.join('')).filter((r) => r.startsWith('v=spf1'));

    if (flat.length === 0) {
      return {
        type: 'SPF',
        name: domain,
        status: 'fail',
        expected: 'v=spf1 include:mxroute.com -all',
        actual: 'No SPF record',
        message: 'No SPF record found',
      };
    }

    if (flat.length > 1) {
      return {
        type: 'SPF',
        name: domain,
        status: 'fail',
        expected: '1 SPF record',
        actual: `${flat.length} SPF records`,
        message: 'Multiple SPF records found — only one allowed per domain',
      };
    }

    const spf = flat[0];
    const hasMxroute = spf.includes('include:mxroute.com') || spf.includes('include:mxlogin.com');
    const hasHardFail = spf.endsWith('-all');

    if (hasMxroute && hasHardFail) {
      return {
        type: 'SPF',
        name: domain,
        status: 'pass',
        expected: 'include:mxroute.com -all',
        actual: spf,
        message: 'SPF record configured correctly',
      };
    } else if (hasMxroute) {
      return {
        type: 'SPF',
        name: domain,
        status: 'warn',
        expected: '-all (hard fail)',
        actual: spf,
        message: 'SPF includes MXroute but uses soft fail (~all) — recommend -all',
      };
    } else {
      return {
        type: 'SPF',
        name: domain,
        status: 'fail',
        expected: 'include:mxroute.com',
        actual: spf,
        message: 'SPF record does not include MXroute',
      };
    }
  } catch (err: any) {
    return {
      type: 'SPF',
      name: domain,
      status: 'fail',
      expected: 'v=spf1 include:mxroute.com -all',
      actual: 'DNS lookup failed',
      message: err.message,
    };
  }
}

export async function checkDkimRecord(domain: string): Promise<DnsCheckResult> {
  try {
    const records = await resolveTxt(`x._domainkey.${domain}`);
    const flat = records.map((r) => r.join(''));

    if (flat.length === 0) {
      return {
        type: 'DKIM',
        name: `x._domainkey.${domain}`,
        status: 'fail',
        expected: 'DKIM key present',
        actual: 'No DKIM record',
        message: 'No DKIM record found at x._domainkey',
      };
    }

    const dkim = flat[0];
    if (dkim.includes('v=DKIM1') && dkim.includes('p=')) {
      return {
        type: 'DKIM',
        name: `x._domainkey.${domain}`,
        status: 'pass',
        expected: 'Valid DKIM key',
        actual: `${dkim.substring(0, 60)}...`,
        message: 'DKIM record configured correctly',
      };
    } else {
      return {
        type: 'DKIM',
        name: `x._domainkey.${domain}`,
        status: 'warn',
        expected: 'v=DKIM1; p=...',
        actual: dkim.substring(0, 60),
        message: 'DKIM record found but may be malformed',
      };
    }
  } catch {
    return {
      type: 'DKIM',
      name: `x._domainkey.${domain}`,
      status: 'fail',
      expected: 'DKIM key at x._domainkey',
      actual: 'DNS lookup failed',
      message: 'No DKIM record found — add TXT record at x._domainkey from Control Panel',
    };
  }
}

export async function checkDmarcRecord(domain: string): Promise<DnsCheckResult> {
  try {
    const records = await resolveTxt(`_dmarc.${domain}`);
    const flat = records.map((r) => r.join(''));

    if (flat.length === 0) {
      return {
        type: 'DMARC',
        name: `_dmarc.${domain}`,
        status: 'warn',
        expected: 'v=DMARC1; p=quarantine;',
        actual: 'No DMARC record',
        message: 'No DMARC record found — strongly recommended',
      };
    }

    const dmarc = flat[0];
    if (dmarc.includes('v=DMARC1')) {
      const hasReject = dmarc.includes('p=reject');
      const hasQuarantine = dmarc.includes('p=quarantine');
      const status = hasReject || hasQuarantine ? 'pass' : 'warn';
      const message = hasReject
        ? 'DMARC with reject policy (strictest)'
        : hasQuarantine
          ? 'DMARC with quarantine policy (recommended)'
          : 'DMARC found but using none policy — consider quarantine or reject';
      return {
        type: 'DMARC',
        name: `_dmarc.${domain}`,
        status,
        expected: 'v=DMARC1; p=quarantine;',
        actual: dmarc,
        message,
      };
    } else {
      return {
        type: 'DMARC',
        name: `_dmarc.${domain}`,
        status: 'fail',
        expected: 'v=DMARC1;',
        actual: dmarc,
        message: 'Record found but not a valid DMARC record',
      };
    }
  } catch {
    return {
      type: 'DMARC',
      name: `_dmarc.${domain}`,
      status: 'warn',
      expected: 'v=DMARC1; p=quarantine;',
      actual: 'No record',
      message: 'No DMARC record found — strongly recommended to add one',
    };
  }
}

export async function checkCustomHostname(
  domain: string,
  server: string,
  subdomain: string = 'mail',
): Promise<DnsCheckResult> {
  try {
    const records = await resolveCname(`${subdomain}.${domain}`);
    const expected = `${server}.mxrouting.net`;
    const matches = records.some((r) => r.toLowerCase().replace(/\.$/, '') === expected.toLowerCase());

    if (matches) {
      return {
        type: 'CNAME',
        name: `${subdomain}.${domain}`,
        status: 'pass',
        expected,
        actual: records[0],
        message: `Custom hostname ${subdomain}.${domain} configured correctly`,
      };
    } else {
      return {
        type: 'CNAME',
        name: `${subdomain}.${domain}`,
        status: 'fail',
        expected,
        actual: records[0],
        message: `CNAME not pointing to ${expected}`,
      };
    }
  } catch {
    return {
      type: 'CNAME',
      name: `${subdomain}.${domain}`,
      status: 'info',
      expected: `${server}.mxrouting.net`,
      actual: 'No CNAME record',
      message: 'No custom hostname configured (optional)',
    };
  }
}

const resolveNs = promisify(resolver.resolveNs.bind(resolver));

import { detectProvider } from '../providers';
import { isMxrouteAuthority } from './dns-router';

export interface NameserverInfo {
  domain: string;
  nameservers: string[];
  isMxrouteAuthority: boolean;
  provider: string | null;
}

/**
 * Check who the authoritative nameservers are for a domain.
 * Returns whether MXroute is the DNS authority (i.e. DirectAdmin DNS changes will take effect).
 */
export async function checkNameservers(domain: string, server: string): Promise<NameserverInfo> {
  try {
    const ns = await resolveNs(domain);
    const nameservers = ns.map((n: string) => n.toLowerCase().replace(/\.$/, ''));
    const mxrouteAuth = isMxrouteAuthority(nameservers, server);

    const detected = detectProvider(nameservers);
    let provider: string | null = detected ? detected.id : null;
    if (!provider && mxrouteAuth) provider = 'mxroute';

    return { domain, nameservers, isMxrouteAuthority: mxrouteAuth, provider };
  } catch {
    return { domain, nameservers: [], isMxrouteAuthority: false, provider: null };
  }
}

export async function runFullDnsCheck(domain: string, server: string): Promise<DnsCheckResult[]> {
  const results = await Promise.all([
    checkMxRecords(domain, server),
    checkSpfRecord(domain),
    checkDkimRecord(domain),
    checkDmarcRecord(domain),
    checkCustomHostname(domain, server, 'mail'),
    checkCustomHostname(domain, server, 'webmail'),
  ]);
  return results;
}
