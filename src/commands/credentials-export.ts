import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { theme } from '../utils/theme';
import { listEmailAccounts } from '../utils/directadmin';
import { getCreds, pickDomain } from '../utils/shared';
import { getConfig } from '../utils/config';

interface CredentialEntry {
  email: string;
  server: string;
  imapPort: number;
  smtpPort: number;
  webmail: string;
}

export function credentialsExportData(
  domain: string,
  accounts: { user: string; password?: string }[],
): CredentialEntry[] {
  const config = getConfig();
  const server = `${config.server}.mxrouting.net`;

  return accounts.map((acct) => ({
    email: `${acct.user}@${domain}`,
    server,
    imapPort: 993,
    smtpPort: 465,
    webmail: `https://${config.server}.mxrouting.net`,
  }));
}

export async function credentialsExport(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Export Credentials: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching accounts...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const accounts = await listEmailAccounts(creds, targetDomain);
    spinner.stop();

    if (accounts.length === 0) {
      console.log(theme.muted('  No email accounts found.\n'));
      return;
    }

    console.log(theme.muted(`  Found ${accounts.length} account${accounts.length !== 1 ? 's' : ''}\n`));

    const { format } = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'Export format:',
        choices: [
          { name: 'CSV', value: 'csv' },
          { name: '1Password (CSV import)', value: '1password' },
          { name: 'JSON', value: 'json' },
        ],
      },
    ]);

    const ext = format === 'json' ? 'json' : 'csv';
    const defaultFile = `credentials-${targetDomain}.${ext}`;

    const { outputPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'outputPath',
        message: theme.secondary('Output file path:'),
        default: defaultFile,
      },
    ]);

    const config = getConfig();
    const server = `${config.server}.mxrouting.net`;
    const resolvedPath = path.resolve(outputPath);
    // Escape CSV field to prevent formula injection
    function csvEscape(field: string): string {
      // If field starts with =, +, -, @, tab, or CR, prefix with single quote
      if (/^[=+\-@\t\r]/.test(field)) {
        field = "'" + field;
      }
      // Quote fields containing comma, quote, or newline
      if (/[",\n\r]/.test(field)) {
        return '"' + field.replace(/"/g, '""') + '"';
      }
      return field;
    }

    let content: string;

    if (format === 'csv') {
      const rows = ['email,server,imap_port,smtp_port'];
      for (const acct of accounts) {
        rows.push(`${csvEscape(`${acct}@${targetDomain}`)},${csvEscape(server)},993,465`);
      }
      content = rows.join('\n') + '\n';
    } else if (format === '1password') {
      const rows = ['Title,Website,Username,Password,Notes'];
      for (const acct of accounts) {
        const email = `${acct}@${targetDomain}`;
        const notes = `Server: ${server} | IMAP: 993 | SMTP: 465`;
        rows.push(
          `${csvEscape(email)},https://${csvEscape(server)},${csvEscape(email)},SET_BY_ADMIN,${csvEscape(notes)}`,
        );
      }
      content = rows.join('\n') + '\n';
    } else {
      const data = credentialsExportData(
        targetDomain,
        accounts.map((a) => ({ user: a })),
      );
      content = JSON.stringify(data, null, 2) + '\n';
    }

    fs.writeFileSync(resolvedPath, content, { mode: 0o600 });

    console.log('');
    console.log(
      chalk.green(
        `  ${theme.statusIcon('pass')} Exported ${accounts.length} account${accounts.length !== 1 ? 's' : ''} to ${resolvedPath}`,
      ),
    );
    console.log(theme.muted(`  File permissions set to 600 (owner read/write only)\n`));
  } catch (err: any) {
    spinner.stop();
    console.log(theme.error(`  ${err.message}\n`));
  }
}
