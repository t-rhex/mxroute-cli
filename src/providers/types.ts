// src/providers/types.ts

export interface DnsRecord {
  id?: string;
  type: string;
  name: string;
  value: string;
  priority?: number;
  ttl?: number;
}

export interface ProviderCredentials {
  [key: string]: string | undefined;
}

export interface ProviderResult {
  success: boolean;
  message: string;
}

export interface CredentialField {
  name: string;
  label: string;
  secret: boolean;
}

export interface DnsProvider {
  id: string;
  name: string;
  nsPatterns: string[];
  credentialFields: CredentialField[];

  validateCredentials(creds: ProviderCredentials): string | null;
  authenticate(creds: ProviderCredentials): Promise<boolean>;
  listZones(creds: ProviderCredentials): Promise<string[]>;
  listRecords(creds: ProviderCredentials, domain: string): Promise<DnsRecord[]>;
  createRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult>;
  deleteRecord(creds: ProviderCredentials, domain: string, record: DnsRecord): Promise<ProviderResult>;
  updateRecord?(
    creds: ProviderCredentials,
    domain: string,
    oldRecord: DnsRecord,
    newRecord: DnsRecord,
  ): Promise<ProviderResult>;
}
