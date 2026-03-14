import * as http from 'http';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { sendEmail } from '../utils/api';

export async function webhookCommand(options: { port?: string }): Promise<void> {
  const config = getConfig();

  if (!config.server || !config.username || !config.password) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} SMTP not configured. Run ${theme.bold('mxroute config smtp')} first.\n`,
      ),
    );
    process.exit(1);
  }

  const port = Number(options.port) || 3025;

  console.log(theme.heading('MXroute Email Webhook Server'));
  console.log(theme.keyValue('Endpoint', `http://localhost:${port}/send`));
  console.log(theme.keyValue('Method', 'POST'));
  console.log(theme.keyValue('Content-Type', 'application/json'));
  console.log(theme.keyValue('From', config.username));
  console.log(theme.keyValue('Rate Limit', '400/hour'));
  console.log('');
  console.log(theme.subheading('Request body:'));
  console.log(theme.muted('    { "to": "user@example.com", "subject": "...", "body": "..." }'));
  console.log(theme.muted('    Optional: "from" (defaults to configured account)'));
  console.log('');

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', server: `${config.server}.mxrouting.net`, from: config.username }));
      return;
    }

    if (req.method !== 'POST' || req.url !== '/send') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. POST to /send or GET /health' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

        if (!data.to || !data.subject || !data.body) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Missing required fields: to, subject, body' }));
          return;
        }

        const result = await sendEmail({
          server: `${config.server}.mxrouting.net`,
          username: config.username,
          password: config.password,
          from: data.from || config.username,
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
