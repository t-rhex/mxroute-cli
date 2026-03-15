import * as fs from 'fs';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getCreds, pickDomain } from '../utils/shared';
import { createEmailAccount, createForwarder } from '../utils/directadmin';

interface CsvRow {
  [key: string]: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .trim()
    .split('\n')
    .map((l) => l.replace(/\r$/, ''));
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = parseCsvLine(line);
      const row: CsvRow = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      return row;
    });
}

export async function bulkAccounts(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Bulk Create Accounts: ${targetDomain}`));
  console.log(theme.subheading('CSV Format:'));
  console.log(theme.muted('    username,password,quota'));
  console.log(theme.muted('    john,SecurePass123!,0'));
  console.log(theme.muted('    jane,AnotherPass456!,500'));
  console.log(theme.muted('    (quota in MB, 0 = unlimited)\n'));

  const { file } = await inquirer.prompt([
    {
      type: 'input',
      name: 'file',
      message: theme.secondary('CSV file path:'),
      validate: (input: string) => (fs.existsSync(input) ? true : 'File not found'),
    },
  ]);

  const rows = parseCsv(fs.readFileSync(file, 'utf-8'));

  if (rows.length === 0) {
    console.log(theme.error('\n  No valid rows found in CSV.\n'));
    return;
  }

  // Validate
  const invalid = rows.filter((r) => !r.username || !r.password);
  if (invalid.length > 0) {
    console.log(theme.error(`\n  ${invalid.length} row(s) missing username or password.\n`));
    return;
  }

  console.log(theme.muted(`\n  Found ${rows.length} account(s) to create on ${targetDomain}`));
  console.log(
    theme.warning(`  ${theme.statusIcon('warn')} CSV file contains plaintext passwords — delete it after use.\n`),
  );

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: `Create ${rows.length} accounts?`,
      default: false,
    },
  ]);

  if (!proceed) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  let success = 0;
  let failed = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const spinner = ora({
      text: `[${idx + 1}/${rows.length}] Creating ${row.username}@${targetDomain}...`,
      spinner: 'dots12',
      color: 'cyan',
    }).start();
    try {
      const result = await createEmailAccount(creds, targetDomain, row.username, row.password, Number(row.quota || 0));
      if (result.error && result.error !== '0') {
        spinner.fail(`${row.username}@${targetDomain}: ${result.text || 'Failed'}`);
        failed++;
      } else {
        spinner.succeed(`${row.username}@${targetDomain}`);
        success++;
      }
    } catch (err: any) {
      spinner.fail(`${row.username}@${targetDomain}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(theme.success(`  ${success} created`));
  if (failed > 0) console.log(theme.error(`  ${failed} failed`));
  console.log('');
}

export async function bulkForwarders(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Bulk Create Forwarders: ${targetDomain}`));
  console.log(theme.subheading('CSV Format:'));
  console.log(theme.muted('    username,destination'));
  console.log(theme.muted('    sales,team@company.com'));
  console.log(theme.muted('    info,hello@company.com\n'));

  const { file } = await inquirer.prompt([
    {
      type: 'input',
      name: 'file',
      message: theme.secondary('CSV file path:'),
      validate: (input: string) => (fs.existsSync(input) ? true : 'File not found'),
    },
  ]);

  const rows = parseCsv(fs.readFileSync(file, 'utf-8'));

  if (rows.length === 0) {
    console.log(theme.error('\n  No valid rows found in CSV.\n'));
    return;
  }

  const invalid = rows.filter((r) => !r.username || !r.destination);
  if (invalid.length > 0) {
    console.log(theme.error(`\n  ${invalid.length} row(s) missing username or destination.\n`));
    return;
  }

  console.log(theme.muted(`\n  Found ${rows.length} forwarder(s) to create on ${targetDomain}\n`));

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: `Create ${rows.length} forwarders?`,
      default: false,
    },
  ]);

  if (!proceed) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  let success = 0;
  let failed = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const spinner = ora({
      text: `[${idx + 1}/${rows.length}] Creating ${row.username}@${targetDomain} → ${row.destination}...`,
      spinner: 'dots12',
      color: 'cyan',
    }).start();
    try {
      const result = await createForwarder(creds, targetDomain, row.username, row.destination);
      if (result.error && result.error !== '0') {
        spinner.fail(`${row.username}: ${result.text || 'Failed'}`);
        failed++;
      } else {
        spinner.succeed(`${row.username}@${targetDomain} → ${row.destination}`);
        success++;
      }
    } catch (err: any) {
      spinner.fail(`${row.username}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(theme.success(`  ${success} created`));
  if (failed > 0) console.log(theme.error(`  ${failed} failed`));
  console.log('');
}
