import fetch from 'node-fetch';

const API_URL = 'https://api.mxroute.com';

export interface MXrouteApiCredentials {
  server: string;
  username: string;
  apiKey: string;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

type FetchLike = (url: string, init: Record<string, unknown>) => Promise<FetchResponse>;

interface ClientOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  maxReadRetries?: number;
  now?: () => number;
  writeIntervalMs?: number;
  readLimitPerMinute?: number;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    field?: string;
  };
}

export class MXrouteApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly field?: string;
  readonly retryAfter?: number;

  constructor(response: FetchResponse, body?: ApiErrorBody) {
    super(body?.error?.message || response.statusText || `MXroute API request failed (${response.status})`);
    this.name = 'MXrouteApiError';
    this.status = response.status;
    this.code = body?.error?.code;
    this.field = body?.error?.field;
    const retryAfter = response.headers.get('retry-after');
    this.retryAfter = retryAfter ? Number(retryAfter) : undefined;
  }
}

export interface MXrouteForwarder {
  alias: string;
  email?: string;
  destinations: string[];
}

export interface MXrouteEmailAccount {
  username: string;
  email?: string;
  quota?: number;
  usage?: number;
  limit?: number;
  sent?: number;
  suspended?: boolean;
}

export interface CreateEmailAccountInput {
  username: string;
  password: string;
  quota?: number;
  limit?: number;
}

export interface UpdateEmailAccountInput {
  password?: string;
  quota?: number;
  limit?: number;
}

export interface MXrouteDomain {
  domain?: string;
  mail_hosting?: boolean;
  ssl_enabled?: boolean;
  pointers?: string[];
}

export interface MXrouteDomainPointer {
  pointer: string;
  type?: 'alias' | 'redirect';
  target?: string;
}

export interface MXrouteCatchAll {
  type: 'fail' | 'blackhole' | 'address';
  address?: string | null;
  description?: string;
}

export interface MXrouteDnsInfo {
  mx_records?: Array<{ priority?: number; hostname?: string; description?: string }>;
  spf?: { type?: string; name?: string; value?: string };
  dkim?: { type?: string; name?: string; value?: string } | null;
  verification?: { type?: string; name?: string; value?: string; description?: string } | null;
}

export interface MXrouteQuota {
  username?: string;
  total_used?: number;
  total_limit?: number;
  percent_used?: number;
  breakdown?: Record<string, number>;
  grace_period?: { days_remaining?: number; deadline?: string } | null;
  updated_at?: string;
}

export interface MXrouteApiClient {
  listDomains(): Promise<string[]>;
  getDomain(domain: string): Promise<MXrouteDomain>;
  listEmailAccounts(domain: string): Promise<MXrouteEmailAccount[]>;
  getEmailAccount(domain: string, username: string): Promise<MXrouteEmailAccount>;
  createEmailAccount(domain: string, input: CreateEmailAccountInput): Promise<void>;
  updateEmailAccount(domain: string, username: string, input: UpdateEmailAccountInput): Promise<void>;
  deleteEmailAccount(domain: string, username: string): Promise<void>;
  listForwarders(domain: string): Promise<MXrouteForwarder[]>;
  createForwarder(domain: string, alias: string, destinations: string[]): Promise<void>;
  deleteForwarder(domain: string, alias: string): Promise<void>;
  listDomainPointers(domain: string): Promise<MXrouteDomainPointer[]>;
  createDomainPointer(domain: string, pointer: string): Promise<void>;
  deleteDomainPointer(domain: string, pointer: string): Promise<void>;
  getCatchAll(domain: string): Promise<MXrouteCatchAll>;
  updateCatchAll(domain: string, catchAll: MXrouteCatchAll): Promise<void>;
  getDnsInfo(domain: string): Promise<MXrouteDnsInfo>;
  getQuota(): Promise<MXrouteQuota>;
}

export function createMXrouteApiClient(
  credentials: MXrouteApiCredentials,
  options: ClientOptions = {},
): MXrouteApiClient {
  const fetchImpl = options.fetch || (fetch as unknown as FetchLike);
  const timeoutMs = options.timeoutMs || 15_000;
  const sleep =
    options.sleep || ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const maxReadRetries = options.maxReadRetries ?? 2;
  const now = options.now || Date.now;
  const writeIntervalMs = options.writeIntervalMs ?? 3_000;
  const readLimitPerMinute = options.readLimitPerMinute ?? 100;
  let lastWriteAt: number | undefined;
  let writeQueue: Promise<void> = Promise.resolve();
  let readQueue: Promise<void> = Promise.resolve();
  const readTimestamps: number[] = [];

  async function executeRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    beforeAttempt?: () => Promise<void>,
    afterAttempt?: () => void,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await beforeAttempt?.();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(`${API_URL}${path}`, {
          method,
          headers: {
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            'X-Server': credentials.server,
            'X-Username': credentials.username,
            'X-API-Key': credentials.apiKey,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
        });
        const text = await response.text();
        const parsedBody = text ? JSON.parse(text) : undefined;
        if (response.ok) return parsedBody as T;

        const error = new MXrouteApiError(response, parsedBody);
        const retryable = response.status === 429 || (method === 'GET' && response.status >= 500);
        if (!retryable || attempt >= maxReadRetries) throw error;
        await sleep((error.retryAfter || 1) * 1000);
      } finally {
        clearTimeout(timeout);
        afterAttempt?.();
      }
    }
  }

  function acquireReadSlot(): Promise<void> {
    const slot = readQueue.then(async () => {
      const cutoff = now() - 60_000;
      while (readTimestamps.length > 0 && readTimestamps[0] <= cutoff) readTimestamps.shift();
      if (readTimestamps.length >= readLimitPerMinute) {
        await sleep(Math.max(0, readTimestamps[0] + 60_000 - now()));
        const nextCutoff = now() - 60_000;
        while (readTimestamps.length > 0 && readTimestamps[0] <= nextCutoff) readTimestamps.shift();
      }
      readTimestamps.push(now());
    });
    readQueue = slot.then(
      () => undefined,
      () => undefined,
    );
    return slot;
  }

  async function acquireWriteSlot(): Promise<void> {
    if (lastWriteAt !== undefined) {
      const waitMs = Math.max(0, writeIntervalMs - (now() - lastWriteAt));
      if (waitMs > 0) await sleep(waitMs);
    }
  }

  function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (method === 'GET') return executeRequest<T>(method, path, body, acquireReadSlot);

    const operation = writeQueue.then(() =>
      executeRequest<T>(method, path, body, acquireWriteSlot, () => {
        lastWriteAt = now();
      }),
    );
    writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  return {
    async listDomains(): Promise<string[]> {
      const response = await request<ApiEnvelope<string[]>>('GET', '/domains');
      return response.data || [];
    },
    async getDomain(domain: string): Promise<MXrouteDomain> {
      const response = await request<ApiEnvelope<MXrouteDomain>>('GET', `/domains/${encodeURIComponent(domain)}`);
      return response.data || {};
    },
    async listEmailAccounts(domain: string): Promise<MXrouteEmailAccount[]> {
      const response = await request<ApiEnvelope<MXrouteEmailAccount[]>>(
        'GET',
        `/domains/${encodeURIComponent(domain)}/email-accounts`,
      );
      return response.data || [];
    },
    async getEmailAccount(domain: string, username: string): Promise<MXrouteEmailAccount> {
      const response = await request<ApiEnvelope<MXrouteEmailAccount>>(
        'GET',
        `/domains/${encodeURIComponent(domain)}/email-accounts/${encodeURIComponent(username)}`,
      );
      return response.data || { username };
    },
    async createEmailAccount(domain: string, input: CreateEmailAccountInput): Promise<void> {
      await request('POST', `/domains/${encodeURIComponent(domain)}/email-accounts`, input);
    },
    async updateEmailAccount(domain: string, username: string, input: UpdateEmailAccountInput): Promise<void> {
      await request(
        'PATCH',
        `/domains/${encodeURIComponent(domain)}/email-accounts/${encodeURIComponent(username)}`,
        input,
      );
    },
    async deleteEmailAccount(domain: string, username: string): Promise<void> {
      await request('DELETE', `/domains/${encodeURIComponent(domain)}/email-accounts/${encodeURIComponent(username)}`);
    },
    async listForwarders(domain: string): Promise<MXrouteForwarder[]> {
      const response = await request<ApiEnvelope<MXrouteForwarder[]>>(
        'GET',
        `/domains/${encodeURIComponent(domain)}/forwarders`,
      );
      return response.data || [];
    },
    async createForwarder(domain: string, alias: string, destinations: string[]): Promise<void> {
      await request('POST', `/domains/${encodeURIComponent(domain)}/forwarders`, { alias, destinations });
    },
    async deleteForwarder(domain: string, alias: string): Promise<void> {
      await request('DELETE', `/domains/${encodeURIComponent(domain)}/forwarders/${encodeURIComponent(alias)}`);
    },
    async listDomainPointers(domain: string): Promise<MXrouteDomainPointer[]> {
      const response = await request<ApiEnvelope<MXrouteDomainPointer[]>>(
        'GET',
        `/domains/${encodeURIComponent(domain)}/pointers`,
      );
      return response.data || [];
    },
    async createDomainPointer(domain: string, pointer: string): Promise<void> {
      await request('POST', `/domains/${encodeURIComponent(domain)}/pointers`, { pointer, alias: true });
    },
    async deleteDomainPointer(domain: string, pointer: string): Promise<void> {
      await request('DELETE', `/domains/${encodeURIComponent(domain)}/pointers/${encodeURIComponent(pointer)}`);
    },
    async getCatchAll(domain: string): Promise<MXrouteCatchAll> {
      const response = await request<ApiEnvelope<MXrouteCatchAll>>(
        'GET',
        `/domains/${encodeURIComponent(domain)}/catch-all`,
      );
      return response.data || { type: 'fail' };
    },
    async updateCatchAll(domain: string, catchAll: MXrouteCatchAll): Promise<void> {
      await request('PATCH', `/domains/${encodeURIComponent(domain)}/catch-all`, catchAll);
    },
    async getDnsInfo(domain: string): Promise<MXrouteDnsInfo> {
      const response = await request<ApiEnvelope<MXrouteDnsInfo>>('GET', `/domains/${encodeURIComponent(domain)}/dns`);
      return response.data || {};
    },
    async getQuota(): Promise<MXrouteQuota> {
      return request<MXrouteQuota>('GET', '/quota');
    },
  };
}
