import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { sendEmail } from '../utils/api';
import { getCreds, pickDomain } from '../utils/shared';
import { listEmailAccounts } from '../utils/directadmin';

interface WelcomeResult {
  email: string;
  success: boolean;
  message: string;
}

function buildWelcomeHtml(email: string, domain: string, companyName?: string, password?: string): string {
  const heading = companyName || 'Your Email Account';
  const passwordSection = password
    ? `<tr><td style="padding:8px 0;color:#888;">Password</td><td style="padding:8px 0;"><code>${password}</code></td></tr>
       <tr><td colspan="2" style="padding:4px 0;color:#e74c3c;font-size:13px;">Please change your password after first login.</td></tr>`
    : '';

  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;">
  <h2 style="color:#6C63FF;">${heading}</h2>
  <p>Welcome! Your email account has been set up and is ready to use.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px 0;color:#888;">Email</td><td style="padding:8px 0;font-weight:bold;">${email}</td></tr>
    ${passwordSection}
  </table>
  <h3 style="color:#6C63FF;">Server Settings</h3>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:6px 0;color:#888;">IMAP</td><td style="padding:6px 0;">server.mxrouting.net — Port 993 (SSL/TLS)</td></tr>
    <tr><td style="padding:6px 0;color:#888;">SMTP</td><td style="padding:6px 0;">server.mxrouting.net — Port 465 (SSL/TLS)</td></tr>
    <tr><td style="padding:6px 0;color:#888;">Username</td><td style="padding:6px 0;">${email}</td></tr>
  </table>
  <h3 style="color:#6C63FF;">Webmail Access</h3>
  <p><a href="https://mail.${domain}">https://mail.${domain}</a></p>
  <h3 style="color:#6C63FF;">Setup Tips</h3>
  <ul style="line-height:1.8;">
    <li><strong>Outlook</strong> — Add an IMAP account with the server settings above.</li>
    <li><strong>Apple Mail</strong> — Go to Settings → Mail → Add Account → Other and enter the IMAP/SMTP details.</li>
    <li><strong>Thunderbird</strong> — Add a new account; Thunderbird may auto-detect settings, otherwise enter them manually.</li>
  </ul>
  <p style="color:#888;font-size:13px;margin-top:24px;">If you have any questions, contact your email administrator.</p>
</div>`;
}

export async function welcomeSend(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Welcome Emails: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    spinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No email accounts found.\n'));
      return;
    }

    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select accounts to send welcome emails to:',
        choices: accounts.map((a) => ({ name: `${a}@${targetDomain}`, value: a })),
      },
    ]);

    if (selected.length === 0) {
      console.log(theme.muted('\n  No accounts selected.\n'));
      return;
    }

    const { companyName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'companyName',
        message: theme.secondary('Company name (optional, for branding):'),
      },
    ]);

    const config = getConfig();
    if (!config.server || !config.username || !config.password) {
      console.log(
        theme.error(`  ${theme.statusIcon('fail')} Not configured. Run ${theme.bold('mxroute config smtp')} first.\n`),
      );
      process.exit(1);
    }

    const from = config.username;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < selected.length; i++) {
      const user = selected[i];
      const email = `${user}@${targetDomain}`;
      const emailSpinner = ora({
        text: `[${i + 1}/${selected.length}] Sending welcome email to ${email}...`,
        spinner: 'dots12',
        color: 'cyan',
      }).start();

      try {
        const result = await sendEmail({
          server: `${config.server}.mxrouting.net`,
          username: config.username,
          password: config.password,
          from,
          to: email,
          subject: `Welcome to ${companyName || 'Your New Email Account'}`,
          body: buildWelcomeHtml(email, targetDomain, companyName || undefined),
        });

        if (result.success) {
          emailSpinner.succeed(`${email}`);
          sent++;
        } else {
          emailSpinner.fail(`${email}: ${result.message}`);
          failed++;
        }
      } catch (err: any) {
        emailSpinner.fail(`${email}: ${err.message}`);
        failed++;
      }
    }

    console.log('');
    console.log(theme.success(`  ${sent} welcome email${sent !== 1 ? 's' : ''} sent`));
    if (failed > 0) console.log(theme.error(`  ${failed} failed`));
    console.log('');
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to fetch accounts'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function welcomeSendBulk(
  accounts: { email: string; password?: string }[],
  companyName?: string,
): Promise<WelcomeResult[]> {
  const config = getConfig();
  if (!config.server || !config.username || !config.password) {
    throw new Error('SMTP not configured. Run "mxroute config smtp" first.');
  }

  const from = config.username;
  const results: WelcomeResult[] = [];

  for (const account of accounts) {
    const domain = account.email.split('@')[1] || '';
    try {
      const result = await sendEmail({
        server: `${config.server}.mxrouting.net`,
        username: config.username,
        password: config.password,
        from,
        to: account.email,
        subject: `Welcome to ${companyName || 'Your New Email Account'}`,
        body: buildWelcomeHtml(account.email, domain, companyName, account.password),
      });

      results.push({
        email: account.email,
        success: result.success,
        message: result.message,
      });
    } catch (err: any) {
      results.push({
        email: account.email,
        success: false,
        message: err.message,
      });
    }
  }

  return results;
}
