import { DnsProvider, DnsRecord, ProviderCredentials, ProviderResult } from './types';

const DETECTION_MESSAGE =
  'Google Cloud DNS requires service account authentication. Use: gcloud dns record-sets create';

export const google: DnsProvider = {
  id: 'google',
  name: 'Google Cloud DNS',
  nsPatterns: ['ns-cloud'],
  detectionOnly: true,
  credentialFields: [
    { name: 'serviceAccountPath', label: 'Service Account JSON file path', secret: false },
    { name: 'projectId', label: 'GCP Project ID', secret: false },
  ],

  validateCredentials(creds: ProviderCredentials): string | null {
    if (!creds.serviceAccountPath || creds.serviceAccountPath.trim() === '') {
      return 'Service Account JSON file path is required';
    }
    if (!creds.projectId || creds.projectId.trim() === '') {
      return 'GCP Project ID is required';
    }
    return null;
  },

  async authenticate(_creds: ProviderCredentials): Promise<boolean> {
    return false;
  },

  async listZones(_creds: ProviderCredentials): Promise<string[]> {
    return [];
  },

  async listRecords(_creds: ProviderCredentials, _domain: string): Promise<DnsRecord[]> {
    return [];
  },

  async createRecord(_creds: ProviderCredentials, _domain: string, _record: DnsRecord): Promise<ProviderResult> {
    return { success: false, message: DETECTION_MESSAGE };
  },

  async deleteRecord(_creds: ProviderCredentials, _domain: string, _record: DnsRecord): Promise<ProviderResult> {
    return { success: false, message: DETECTION_MESSAGE };
  },
};
