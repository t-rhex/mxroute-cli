import fetch from 'node-fetch';

const API_URL = 'https://smtpapi.mxroute.com/';

export interface SendEmailOptions {
  server: string;
  username: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}

export interface ApiResponse {
  success: boolean;
  message: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<ApiResponse> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  const result = (await response.json()) as ApiResponse;
  return result;
}

export async function testConnection(server: string, username: string, password: string): Promise<ApiResponse> {
  return sendEmail({
    server,
    username,
    password,
    from: username,
    to: username,
    subject: 'MXroute CLI Connection Test',
    body: '<p>This is a test email sent from the MXroute CLI to verify your configuration.</p>',
  });
}
