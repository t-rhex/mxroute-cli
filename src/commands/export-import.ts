import * as fs from 'fs';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getCreds, pickDomain } from '../utils/shared';
import {
  listEmailAccounts,
  listForwarders,
  getForwarderDestination,
  listAutoresponders,
  getAutoresponder,
  getCatchAll,
  getSpamConfig,
  createForwarder,
  createAutoresponder,
  setCatchAll,
} from '../utils/directadmin';

interface ExportData {
  version: string;
  exportedAt: string;
  domain: string;
  accounts: { user: string; quota?: number }[];
  forwarders: { user: string; destination: string }[];
  autoresponders: { user: string; text: string; cc?: string }[];
  catchAll: string;
  spamConfig: any;
}

export async function exportCommand(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Export: ${targetDomain}`));

  const spinner = ora({ text: 'Exporting configuration...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const [accounts, forwarders, autoresponders, catchAll, spamConfig] = await Promise.all([
      listEmailAccounts(creds, targetDomain),
      listForwarders(creds, targetDomain),
      listAutoresponders(creds, targetDomain),
      getCatchAll(creds, targetDomain).catch(() => ''),
      getSpamConfig(creds, targetDomain).catch(() => ({})),
    ]);

    // Get forwarder destinations
    const fwdDetails = [];
    for (const fwd of forwarders) {
      try {
        const dest = await getForwarderDestination(creds, targetDomain, fwd);
        fwdDetails.push({ user: fwd, destination: dest });
      } catch {
        fwdDetails.push({ user: fwd, destination: '' });
      }
    }

    // Get autoresponder details
    const arDetails = [];
    for (const ar of autoresponders) {
      try {
        const details = await getAutoresponder(creds, targetDomain, ar);
        arDetails.push({ user: ar, text: details.text || details.message || '', cc: details.cc });
      } catch {
        arDetails.push({ user: ar, text: '', cc: undefined });
      }
    }

    const exportData: ExportData = {
      version: '1',
      exportedAt: new Date().toISOString(),
      domain: targetDomain,
      accounts: accounts.map((a) => ({ user: a })),
      forwarders: fwdDetails,
      autoresponders: arDetails,
      catchAll,
      spamConfig,
    };

    spinner.stop();

    const filename = `mxroute-export-${targetDomain}-${new Date().toISOString().split('T')[0]}.json`;

    const { outputFile } = await inquirer.prompt([
      {
        type: 'input',
        name: 'outputFile',
        message: theme.secondary('Output file:'),
        default: filename,
      },
    ]);

    fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));

    console.log('');
    console.log(theme.success(`  ${theme.statusIcon('pass')} Exported to ${outputFile}`));
    console.log(
      theme.muted(
        `  ${accounts.length} accounts, ${forwarders.length} forwarders, ${autoresponders.length} autoresponders`,
      ),
    );
    console.log('');
  } catch (err: any) {
    spinner.fail('Export failed');
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function importCommand(file?: string): Promise<void> {
  if (!file) {
    const { inputFile } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputFile',
        message: theme.secondary('Import file:'),
        validate: (input: string) => (fs.existsSync(input) ? true : 'File not found'),
      },
    ]);
    file = inputFile;
  }

  const creds = getCreds();
  let data: ExportData;
  try {
    const raw = JSON.parse(fs.readFileSync(file!, 'utf-8'));
    if (!raw || typeof raw !== 'object' || !raw.domain || typeof raw.domain !== 'string') {
      console.log(
        theme.error(`\n  ${theme.statusIcon('fail')} Invalid export file: missing required "domain" field.\n`),
      );
      return;
    }
    data = {
      version: raw.version || '1',
      exportedAt: raw.exportedAt || 'unknown',
      domain: raw.domain,
      accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
      forwarders: Array.isArray(raw.forwarders) ? raw.forwarders : [],
      autoresponders: Array.isArray(raw.autoresponders) ? raw.autoresponders : [],
      catchAll: typeof raw.catchAll === 'string' ? raw.catchAll : '',
      spamConfig: raw.spamConfig || {},
    };
  } catch (err: any) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Failed to parse import file: ${err.message}\n`));
    return;
  }

  console.log(theme.heading(`Import: ${data.domain}`));
  console.log(theme.muted(`  Exported at: ${data.exportedAt}`));
  console.log(
    theme.muted(
      `  ${data.accounts.length} accounts, ${data.forwarders.length} forwarders, ${data.autoresponders.length} autoresponders`,
    ),
  );
  console.log('');

  console.log(theme.warning(`  ${theme.statusIcon('warn')} This will create accounts/forwarders on ${data.domain}.`));
  console.log(theme.warning(`  ${theme.statusIcon('warn')} Existing items will NOT be overwritten.`));
  console.log(
    theme.warning(`  ${theme.statusIcon('warn')} Account passwords are NOT exported — new passwords will be needed.\n`),
  );

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Continue with import?',
      default: false,
    },
  ]);

  if (!proceed) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  // Import forwarders
  if (data.forwarders.length > 0) {
    console.log(theme.subheading('\nForwarders'));
    for (const fwd of data.forwarders) {
      try {
        await createForwarder(creds, data.domain, fwd.user, fwd.destination);
        console.log(`    ${theme.statusIcon('pass')} ${fwd.user}@${data.domain} -> ${fwd.destination}`);
      } catch (err: any) {
        console.log(`    ${theme.statusIcon('fail')} ${fwd.user}: ${err.message}`);
      }
    }
  }

  // Import autoresponders
  if (data.autoresponders.length > 0) {
    console.log(theme.subheading('\nAutoresponders'));
    for (const ar of data.autoresponders) {
      if (!ar.text) continue;
      try {
        await createAutoresponder(creds, data.domain, ar.user, ar.text, ar.cc);
        console.log(`    ${theme.statusIcon('pass')} ${ar.user}@${data.domain}`);
      } catch (err: any) {
        console.log(`    ${theme.statusIcon('fail')} ${ar.user}: ${err.message}`);
      }
    }
  }

  // Import catch-all
  if (data.catchAll) {
    console.log(theme.subheading('\nCatch-All'));
    try {
      await setCatchAll(creds, data.domain, data.catchAll);
      console.log(`    ${theme.statusIcon('pass')} Set to: ${data.catchAll}`);
    } catch (err: any) {
      console.log(`    ${theme.statusIcon('fail')} ${err.message}`);
    }
  }

  console.log('');
  console.log(theme.info(`  ${theme.statusIcon('info')} Accounts were NOT created — they need passwords.`));
  console.log(theme.muted(`  Create them manually: mxroute accounts create ${data.domain}\n`));
}
