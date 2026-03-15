import fetch from 'node-fetch';

export interface DACredentials {
  server: string;
  username: string;
  loginKey: string;
}

function getBaseUrl(server: string): string {
  const host = server.includes('.') ? server : `${server}.mxrouting.net`;
  return `https://${host}:2222`;
}

function getAuthHeader(username: string, loginKey: string): string {
  return 'Basic ' + Buffer.from(`${username}:${loginKey}`).toString('base64');
}

async function daRequest(
  creds: DACredentials,
  endpoint: string,
  method: string = 'GET',
  body?: Record<string, string>,
): Promise<any> {
  const url = `${getBaseUrl(creds.server)}/${endpoint}${endpoint.includes('?') ? '&' : '?'}json=yes`;

  const headers: Record<string, string> = {
    Authorization: getAuthHeader(creds.username, creds.loginKey),
  };

  const options: any = { method, headers };

  if (body && (method === 'POST' || method === 'PUT')) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = new URLSearchParams(body).toString();
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to ${getBaseUrl(creds.server)}. Check your server hostname and internet connection.`,
      );
    }
    if (err.code === 'ENOTFOUND') {
      throw new Error(`Server "${creds.server}" not found. Check your server hostname (e.g., tuesday, fusion).`);
    }
    if (err.code === 'ETIMEDOUT' || err.type === 'request-timeout') {
      throw new Error('Connection timed out. Check your internet connection and try again.');
    }
    throw new Error(`Network error: ${err.message}`);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication failed. Check your username and login key. Run: mxroute config setup');
    }
    if (response.status === 403) {
      throw new Error(
        'Access denied. Your login key may lack required permissions. Regenerate it at panel.mxroute.com → Login Keys.',
      );
    }
    if (response.status === 404) {
      throw new Error('API endpoint not found. Check your server hostname is correct.');
    }
    throw new Error(`DirectAdmin API error: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    // Some endpoints return URL-encoded data even with json=yes
    // Try to parse as URL-encoded
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }
}

// === Domain Operations ===

export async function listDomains(creds: DACredentials): Promise<string[]> {
  const result = await daRequest(creds, 'CMD_API_SHOW_DOMAINS');
  if (Array.isArray(result)) return result;
  if (result.list) return result.list;
  // Sometimes returns {domain1: '', domain2: ''}
  return Object.keys(result).filter((k) => k !== 'error' && k !== 'text');
}

export async function getDomainInfo(creds: DACredentials, domain: string): Promise<any> {
  return daRequest(creds, `CMD_API_DOMAIN?domain=${encodeURIComponent(domain)}`);
}

// === Email Account Operations ===

export async function listEmailAccounts(creds: DACredentials, domain: string): Promise<string[]> {
  const result = await daRequest(creds, `CMD_API_POP?domain=${encodeURIComponent(domain)}&action=list`);
  if (Array.isArray(result)) return result;
  if (result.list) return result.list;
  return Object.keys(result).filter((k) => k !== 'error' && k !== 'text');
}

export async function getEmailAccountInfo(creds: DACredentials, domain: string, user: string): Promise<any> {
  return daRequest(
    creds,
    `CMD_API_POP?domain=${encodeURIComponent(domain)}&action=list&user=${encodeURIComponent(user)}`,
  );
}

export async function createEmailAccount(
  creds: DACredentials,
  domain: string,
  user: string,
  password: string,
  quota: number = 0,
): Promise<any> {
  return daRequest(creds, 'CMD_API_POP', 'POST', {
    action: 'create',
    domain,
    user,
    passwd: password,
    passwd2: password,
    quota: quota.toString(),
    limit: '0', // 0 = unlimited sending
  });
}

export async function deleteEmailAccount(creds: DACredentials, domain: string, user: string): Promise<any> {
  return daRequest(creds, 'CMD_API_POP', 'POST', {
    action: 'delete',
    domain,
    user,
  });
}

export async function changeEmailPassword(
  creds: DACredentials,
  domain: string,
  user: string,
  password: string,
): Promise<any> {
  return daRequest(creds, 'CMD_API_POP', 'POST', {
    action: 'modify',
    domain,
    user,
    passwd: password,
    passwd2: password,
  });
}

export async function changeEmailQuota(
  creds: DACredentials,
  domain: string,
  user: string,
  quota: number,
): Promise<any> {
  return daRequest(creds, 'CMD_API_POP', 'POST', {
    action: 'modify',
    domain,
    user,
    quota: quota.toString(),
  });
}

// === Forwarder Operations ===

export async function listForwarders(creds: DACredentials, domain: string): Promise<string[]> {
  const result = await daRequest(creds, `CMD_API_EMAIL_FORWARDERS?domain=${encodeURIComponent(domain)}&action=list`);
  if (Array.isArray(result)) return result;
  if (result.list) return result.list;
  return Object.keys(result).filter((k) => k !== 'error' && k !== 'text');
}

export async function getForwarderDestination(creds: DACredentials, domain: string, user: string): Promise<string> {
  const result = await daRequest(
    creds,
    `CMD_API_EMAIL_FORWARDERS?domain=${encodeURIComponent(domain)}&action=list&user=${encodeURIComponent(user)}`,
  );
  if (typeof result === 'string') return result;
  if (result.dest) return result.dest;
  return JSON.stringify(result);
}

export async function createForwarder(
  creds: DACredentials,
  domain: string,
  user: string,
  destination: string,
): Promise<any> {
  return daRequest(creds, 'CMD_API_EMAIL_FORWARDERS', 'POST', {
    action: 'create',
    domain,
    user,
    email: destination,
  });
}

export async function deleteForwarder(creds: DACredentials, domain: string, user: string): Promise<any> {
  return daRequest(creds, 'CMD_API_EMAIL_FORWARDERS', 'POST', {
    action: 'delete',
    domain,
    select0: user,
  });
}

// === Catch-All Operations ===

export async function getCatchAll(creds: DACredentials, domain: string): Promise<string> {
  const result = await daRequest(creds, `CMD_API_EMAIL_CATCH_ALL?domain=${encodeURIComponent(domain)}`);
  if (typeof result === 'string') return result;
  if (result.value) return result.value;
  if (result.catch) return result.catch;
  // Return first meaningful value
  const keys = Object.keys(result).filter((k) => k !== 'error' && k !== 'text');
  if (keys.length > 0) return result[keys[0]] || keys[0];
  return '';
}

export async function setCatchAll(creds: DACredentials, domain: string, value: string): Promise<any> {
  return daRequest(creds, 'CMD_API_EMAIL_CATCH_ALL', 'POST', {
    action: 'update',
    domain,
    value,
  });
}

// === Quota / Usage ===

export async function getQuotaUsage(creds: DACredentials): Promise<any> {
  return daRequest(creds, 'CMD_API_SHOW_USER_USAGE');
}

export async function getUserConfig(creds: DACredentials): Promise<any> {
  return daRequest(creds, 'CMD_API_SHOW_USER_CONFIG');
}

// === Domain Pointers (Aliases) ===

export async function listDomainPointers(creds: DACredentials, domain: string): Promise<Record<string, string>> {
  const result = await daRequest(creds, `CMD_API_DOMAIN_POINTER?domain=${encodeURIComponent(domain)}&action=list`);
  if (typeof result === 'object' && !Array.isArray(result)) {
    return result;
  }
  return {};
}

// === SpamAssassin Operations ===

export async function getSpamConfig(creds: DACredentials, domain: string): Promise<any> {
  return daRequest(creds, `CMD_API_SPAMASSASSIN?domain=${encodeURIComponent(domain)}`);
}

export async function setSpamConfig(
  creds: DACredentials,
  domain: string,
  settings: Record<string, string>,
): Promise<any> {
  return daRequest(creds, 'CMD_API_SPAMASSASSIN', 'POST', {
    domain,
    ...settings,
  });
}

export async function addDomainPointer(creds: DACredentials, domain: string, pointer: string): Promise<any> {
  return daRequest(creds, 'CMD_API_DOMAIN_POINTER', 'POST', {
    action: 'add',
    domain,
    from: pointer,
  });
}

export async function deleteDomainPointer(creds: DACredentials, domain: string, pointer: string): Promise<any> {
  return daRequest(creds, 'CMD_API_DOMAIN_POINTER', 'POST', {
    action: 'delete',
    domain,
    select0: pointer,
  });
}

// === Email Filter Operations ===

export async function listEmailFilters(creds: DACredentials, domain: string, user: string): Promise<any[]> {
  const result = await daRequest(
    creds,
    `CMD_API_EMAIL_FILTER?domain=${encodeURIComponent(domain)}&user=${encodeURIComponent(user)}&action=list`,
  );
  if (Array.isArray(result)) return result;
  if (result.list) return result.list;
  const keys = Object.keys(result).filter((k) => k !== 'error' && k !== 'text');
  if (keys.length === 0) return [];
  return keys.map((k) => ({ name: k, ...(typeof result[k] === 'object' ? result[k] : { value: result[k] }) }));
}

export async function createEmailFilter(
  creds: DACredentials,
  domain: string,
  user: string,
  filterData: Record<string, string>,
): Promise<any> {
  return daRequest(creds, 'CMD_API_EMAIL_FILTER', 'POST', {
    action: 'create',
    domain,
    user,
    ...filterData,
  });
}

export async function deleteEmailFilter(
  creds: DACredentials,
  domain: string,
  user: string,
  filterName: string,
): Promise<any> {
  return daRequest(creds, 'CMD_API_EMAIL_FILTER', 'POST', {
    action: 'delete',
    domain,
    user,
    select0: filterName,
  });
}

// === Auth Test ===

export async function testAuth(
  creds: DACredentials,
): Promise<{ success: boolean; message: string; username?: string }> {
  try {
    const config = await getUserConfig(creds);
    return {
      success: true,
      message: 'Authentication successful',
      username: config.username || creds.username,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
    };
  }
}

// === Autoresponder Operations ===

export async function listAutoresponders(creds: DACredentials, domain: string): Promise<string[]> {
  const result = await daRequest(creds, `CMD_API_EMAIL_AUTORESPONDER?domain=${encodeURIComponent(domain)}`);
  if (Array.isArray(result)) return result;
  if (result.list) return result.list;
  return Object.keys(result).filter((k) => k !== 'error' && k !== 'text' && k !== 'details');
}

export async function getAutoresponder(creds: DACredentials, domain: string, user: string): Promise<any> {
  return daRequest(
    creds,
    `CMD_API_EMAIL_AUTORESPONDER?domain=${encodeURIComponent(domain)}&user=${encodeURIComponent(user)}`,
  );
}

export async function createAutoresponder(
  creds: DACredentials,
  domain: string,
  user: string,
  text: string,
  cc?: string,
): Promise<any> {
  const body: Record<string, string> = {
    action: 'create',
    domain,
    user,
    text,
  };
  if (cc) body.cc = cc;
  return daRequest(creds, 'CMD_API_EMAIL_AUTORESPONDER', 'POST', body);
}

export async function modifyAutoresponder(
  creds: DACredentials,
  domain: string,
  user: string,
  text: string,
  cc?: string,
): Promise<any> {
  const body: Record<string, string> = {
    action: 'modify',
    domain,
    user,
    text,
  };
  if (cc) body.cc = cc;
  return daRequest(creds, 'CMD_API_EMAIL_AUTORESPONDER', 'POST', body);
}

export async function deleteAutoresponder(creds: DACredentials, domain: string, user: string): Promise<any> {
  return daRequest(creds, 'CMD_API_EMAIL_AUTORESPONDER', 'POST', {
    action: 'delete',
    domain,
    select0: user,
  });
}

// === DNS Record Management ===

export async function listDnsRecords(creds: DACredentials, domain: string): Promise<any> {
  return daRequest(creds, `CMD_API_DNS_CONTROL?domain=${encodeURIComponent(domain)}`);
}

export async function addDnsRecord(
  creds: DACredentials,
  domain: string,
  type: string,
  name: string,
  value: string,
  priority?: number,
): Promise<any> {
  const body: Record<string, string> = {
    action: 'add',
    domain,
    type,
    name,
    value,
  };
  if (priority !== undefined) body.priority = priority.toString();
  return daRequest(creds, 'CMD_API_DNS_CONTROL', 'POST', body);
}

export async function deleteDnsRecord(
  creds: DACredentials,
  domain: string,
  type: string,
  name: string,
  value: string,
): Promise<any> {
  // DirectAdmin uses select format: type_name_value encoded
  const selectKey = `${type}recs0`;
  return daRequest(creds, 'CMD_API_DNS_CONTROL', 'POST', {
    action: 'select',
    domain,
    [selectKey]: `name=${encodeURIComponent(name)}&value=${encodeURIComponent(value)}`,
  });
}

export async function getDkimKey(creds: DACredentials, domain: string): Promise<string | null> {
  try {
    const records = await listDnsRecords(creds, domain);
    if (!records || typeof records !== 'object') return null;

    // Deep search through all values for _domainkey / DKIM1
    const searchObj = (obj: any): string | null => {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (item && typeof item === 'object') {
            const name = String(item.name || '');
            const value = String(item.value || '');
            if (name.includes('_domainkey') && value.includes('DKIM1')) return value;
          }
          if (typeof item === 'string' && item.includes('DKIM1')) return item;
        }
      }
      return null;
    };

    // Check typed arrays (TXT, txt_records, etc.)
    for (const [, val] of Object.entries(records)) {
      if (Array.isArray(val)) {
        const found = searchObj(val);
        if (found) return found;
      }
    }

    // Check numbered entries (DirectAdmin format: "0": "TXT name=x._domainkey value=...")
    for (const [key, val] of Object.entries(records)) {
      const v = String(val);
      if (v.includes('_domainkey') && v.includes('DKIM1')) {
        // Extract the value part
        const valueMatch = v.match(/value=(.+?)(?:\s+ttl=|$)/);
        return valueMatch ? valueMatch[1].trim().replace(/^"|"$/g, '') : v;
      }
      if (key.includes('_domainkey') && v.includes('DKIM1')) {
        return v.replace(/^"|"$/g, '');
      }
    }

    return null;
  } catch {
    return null;
  }
}

// === Mailing Lists ===

export async function listMailingLists(creds: DACredentials, domain: string): Promise<string[]> {
  const result = await daRequest(creds, `CMD_API_EMAIL_LIST?domain=${encodeURIComponent(domain)}&action=list`);
  if (Array.isArray(result)) return result;
  if (result.list) return result.list;
  return Object.keys(result).filter((k) => k !== 'error' && k !== 'text' && k !== 'details');
}

export async function getMailingListMembers(creds: DACredentials, domain: string, name: string): Promise<string[]> {
  const result = await daRequest(
    creds,
    `CMD_API_EMAIL_LIST?domain=${encodeURIComponent(domain)}&action=view&name=${encodeURIComponent(name)}`,
  );
  if (Array.isArray(result)) return result;
  if (result.list) return result.list;
  return Object.keys(result).filter((k) => k !== 'error' && k !== 'text' && k !== 'details');
}

export async function createMailingList(creds: DACredentials, domain: string, name: string): Promise<any> {
  return daRequest(creds, 'CMD_API_EMAIL_LIST', 'POST', {
    action: 'create',
    domain,
    name,
  });
}

export async function deleteMailingList(creds: DACredentials, domain: string, name: string): Promise<any> {
  return daRequest(creds, 'CMD_API_EMAIL_LIST', 'POST', {
    action: 'delete',
    domain,
    select0: name,
  });
}

export async function addMailingListMember(
  creds: DACredentials,
  domain: string,
  name: string,
  email: string,
): Promise<any> {
  return daRequest(creds, 'CMD_API_EMAIL_LIST', 'POST', {
    action: 'add',
    domain,
    name,
    email,
  });
}

export async function removeMailingListMember(
  creds: DACredentials,
  domain: string,
  name: string,
  email: string,
): Promise<any> {
  return daRequest(creds, 'CMD_API_EMAIL_LIST', 'POST', {
    action: 'delete_subscriber',
    domain,
    name,
    select0: email,
  });
}
