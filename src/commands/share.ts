import * as fs from 'fs';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { getCreds, pickDomain } from '../utils/shared';
import { listEmailAccounts } from '../utils/directadmin';

export async function shareCommand(email?: string): Promise<void> {
  const config = getConfig();
  const server = config.server ? `${config.server}.mxrouting.net` : '';

  if (!server) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Run ${theme.bold('mxroute config setup')} first.\n`));
    return;
  }

  // If no email specified, pick from accounts
  if (!email) {
    if (config.daUsername && config.daLoginKey) {
      const creds = getCreds();
      const domain = await pickDomain(creds);
      const accounts = await listEmailAccounts(creds, domain);
      if (accounts.length > 0) {
        const { selected } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selected',
            message: 'Generate setup instructions for:',
            choices: accounts.map((a) => `${a}@${domain}`),
          },
        ]);
        email = selected;
      }
    }
    if (!email) {
      const { manualEmail } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualEmail',
          message: theme.secondary('Email address:'),
          validate: (input: string) => (input.includes('@') ? true : 'Enter a valid email'),
        },
      ]);
      email = manualEmail;
    }
  }

  const { format } = await inquirer.prompt([
    {
      type: 'list',
      name: 'format',
      message: 'Output format:',
      choices: [
        { name: 'Terminal (print settings)', value: 'terminal' },
        { name: 'HTML file (shareable page)', value: 'html' },
      ],
    },
  ]);

  if (format === 'terminal') {
    printTerminalConfig(email!, server);
  } else {
    await generateHtml(email!, server);
  }
}

function printTerminalConfig(email: string, server: string): void {
  console.log(theme.heading(`Email Setup: ${email}`));

  console.log(theme.subheading('Incoming Mail (IMAP)'));
  console.log(theme.keyValue('Server', server));
  console.log(theme.keyValue('Port', '993'));
  console.log(theme.keyValue('Encryption', 'SSL/TLS'));
  console.log(theme.keyValue('Username', email));
  console.log(theme.keyValue('Password', '(your email password)'));

  console.log('');
  console.log(theme.subheading('Outgoing Mail (SMTP)'));
  console.log(theme.keyValue('Server', server));
  console.log(theme.keyValue('Port', '465'));
  console.log(theme.keyValue('Encryption', 'SSL/TLS'));
  console.log(theme.keyValue('Username', email));
  console.log(theme.keyValue('Password', '(your email password)'));
  console.log(theme.keyValue('Auth', 'Required'));

  console.log('');
  console.log(theme.subheading('Webmail'));
  console.log(theme.keyValue('Roundcube', `https://${server}/roundcube`));
  console.log(theme.keyValue('Crossbox', `https://${server}/crossbox`));

  console.log('');
  console.log(theme.subheading('CalDAV / CardDAV'));
  console.log(theme.keyValue('Server', 'https://dav.mxroute.com'));
  console.log(theme.keyValue('Username', email));
  console.log('');
}

async function generateHtml(email: string, server: string): Promise<void> {
  const filename = `email-setup-${email.replace('@', '-at-')}.html`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Email Setup — ${email}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0f0f23; color: #e0e0e0; min-height: 100vh; padding: 2rem; }
  .container { max-width: 600px; margin: 0 auto; }
  h1 { color: #00D9FF; font-size: 1.5rem; margin-bottom: 0.5rem; }
  h2 { color: #6C63FF; font-size: 1.1rem; margin: 1.5rem 0 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #222; }
  .subtitle { color: #7C8DB0; margin-bottom: 2rem; }
  .row { display: flex; padding: 0.4rem 0; }
  .label { color: #7C8DB0; width: 140px; flex-shrink: 0; }
  .value { color: #fff; font-family: 'SF Mono', monospace; word-break: break-all; }
  .value.highlight { color: #00E676; }
  .card { background: #1a1a2e; border: 1px solid #222; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
  .note { color: #7C8DB0; font-size: 0.85rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #222; }
  .badge { display: inline-block; background: #6C63FF; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px; }
  @media (prefers-color-scheme: light) {
    body { background: #f5f5f5; color: #333; }
    .card { background: #fff; border-color: #ddd; }
    .label { color: #666; }
    .value { color: #111; }
    h1 { color: #6C63FF; }
  }
</style>
</head>
<body>
<div class="container">
  <h1>Email Setup</h1>
  <p class="subtitle">${email}</p>

  <h2>Incoming Mail (IMAP) <span class="badge">Recommended</span></h2>
  <div class="card">
    <div class="row"><span class="label">Server</span><span class="value">${server}</span></div>
    <div class="row"><span class="label">Port</span><span class="value highlight">993</span></div>
    <div class="row"><span class="label">Encryption</span><span class="value">SSL/TLS</span></div>
    <div class="row"><span class="label">Username</span><span class="value">${email}</span></div>
    <div class="row"><span class="label">Password</span><span class="value">Your email password</span></div>
  </div>

  <h2>Outgoing Mail (SMTP)</h2>
  <div class="card">
    <div class="row"><span class="label">Server</span><span class="value">${server}</span></div>
    <div class="row"><span class="label">Port</span><span class="value highlight">465</span></div>
    <div class="row"><span class="label">Encryption</span><span class="value">SSL/TLS</span></div>
    <div class="row"><span class="label">Username</span><span class="value">${email}</span></div>
    <div class="row"><span class="label">Password</span><span class="value">Your email password</span></div>
    <div class="row"><span class="label">Authentication</span><span class="value">Required</span></div>
  </div>

  <h2>Webmail Access</h2>
  <div class="card">
    <div class="row"><span class="label">Roundcube</span><span class="value"><a href="https://${server}/roundcube" style="color: #00D9FF">https://${server}/roundcube</a></span></div>
    <div class="row"><span class="label">Crossbox</span><span class="value"><a href="https://${server}/crossbox" style="color: #00D9FF">https://${server}/crossbox</a></span></div>
  </div>

  <h2>Calendar & Contacts (CalDAV/CardDAV)</h2>
  <div class="card">
    <div class="row"><span class="label">Server</span><span class="value">https://dav.mxroute.com</span></div>
    <div class="row"><span class="label">Username</span><span class="value">${email}</span></div>
  </div>

  <h2>Alternative Ports</h2>
  <div class="card">
    <div class="row"><span class="label">IMAP</span><span class="value">143 (STARTTLS)</span></div>
    <div class="row"><span class="label">SMTP</span><span class="value">587 (STARTTLS) or 2525 (if 587 blocked)</span></div>
    <div class="row"><span class="label">POP3</span><span class="value">995 (SSL) or 110 (STARTTLS)</span></div>
  </div>

  <p class="note">Generated by <strong>mxroute-cli</strong> — ${new Date().toLocaleDateString()}</p>
</div>
</body>
</html>`;

  const { outputFile } = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputFile',
      message: theme.secondary('Output file:'),
      default: filename,
    },
  ]);

  fs.writeFileSync(outputFile, html);
  console.log(theme.success(`\n  ${theme.statusIcon('pass')} Saved to ${outputFile}`));
  console.log(theme.muted(`  Share this file with the user to help them set up their email client.\n`));
}
