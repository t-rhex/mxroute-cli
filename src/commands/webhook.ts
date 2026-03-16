import * as http from 'http';
import { theme } from '../utils/theme';
import { sendEmail } from '../utils/api';
import { getSendingAccountSync } from '../utils/sending-account';

const MAX_BODY_SIZE = 1024 * 1024; // 1MB max request body

export async function webhookCommand(options: { port?: string; apiKey?: string }): Promise<void> {
  const account = getSendingAccountSync();

  if (!account) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} No sending account configured. Run ${theme.bold('mxroute send')} to set one up.\n`,
      ),
    );
    process.exit(1);
  }

  const port = Number(options.port) || 3025;

  console.log(theme.heading('MXroute Email Webhook Server'));
  console.log(theme.keyValue('Endpoint', `http://localhost:${port}/send`));
  console.log(theme.keyValue('Method', 'POST'));
  console.log(theme.keyValue('Content-Type', 'application/json'));
  console.log(theme.keyValue('From', account.email));
  console.log(theme.keyValue('Rate Limit', '400/hour'));
  if (options.apiKey) {
    console.log(theme.keyValue('Auth', 'Required (Bearer token or X-API-Key header)'));
  } else {
    console.log(theme.keyValue('Auth', theme.warning('None — anyone can send email. Use --api-key for security.')));
  }
  console.log('');
  console.log(theme.subheading('Request body:'));
  console.log(theme.muted('    { "to": "user@example.com", "subject": "...", "body": "..." }'));
  console.log(theme.muted('    Optional: "from" (defaults to configured account)'));
  console.log('');

  const server = http.createServer(async (req, res) => {
    // CORS headers — restrict to localhost only
    const origin = req.headers.origin || '';
    const allowedOrigins = [`http://localhost:${port}`, 'http://localhost', 'http://127.0.0.1'];
    if (allowedOrigins.some((o) => origin.startsWith(o))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (options.apiKey) {
      const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || '';
      const token = typeof authHeader === 'string' ? authHeader : '';
      if (token !== `Bearer ${options.apiKey}` && token !== options.apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Unauthorized. Provide API key via Authorization: Bearer <key> or X-API-Key header.',
          }),
        );
        return;
      }
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method !== 'POST' || req.url !== '/send') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. POST to /send or GET /health' }));
      return;
    }

    let body = '';
    let bodyTooLarge = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (bodyTooLarge) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Request body too large (max 1MB)' }));
        return;
      }
      try {
        const data = JSON.parse(body);

        if (!data.to || !data.subject || !data.body) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Missing required fields: to, subject, body' }));
          return;
        }

        const result = await sendEmail({
          server: account.server,
          username: account.email,
          password: account.password,
          from: data.from || account.email,
          to: data.to,
          subject: data.subject,
          body: data.body,
        });

        const timestamp = new Date().toISOString();
        const status = result.success ? 'sent' : 'failed';
        console.log(theme.muted(`  ${timestamp}  ${status}  → ${data.to}  "${data.subject}"`));

        res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message || 'Invalid JSON' }));
      }
    });
  });

  server.listen(port, () => {
    console.log(theme.success(`  ${theme.statusIcon('pass')} Listening on http://localhost:${port}`));
    console.log(theme.muted('  Press Ctrl+C to stop\n'));
    console.log(theme.subheading('Example:'));
    console.log(theme.muted(`    curl -X POST http://localhost:${port}/send \\`));
    console.log(theme.muted('      -H "Content-Type: application/json" \\'));
    console.log(theme.muted('      -d \'{"to":"user@example.com","subject":"Test","body":"Hello!"}\''));
    console.log('');
    console.log(theme.separator());
    console.log('');
  });
}
