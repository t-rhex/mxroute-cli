import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { getCreds } from '../utils/shared';
import { listEmailAccounts } from '../utils/directadmin';

export async function migrateCommand(): Promise<void> {
  console.log(theme.heading('Email Migration Wizard'));
  console.log(theme.muted('  Migrate email from another provider to MXroute.\n'));

  const config = getConfig();
  const creds = getCreds();

  // Step 1: Source server
  const source = await inquirer.prompt([
    {
      type: 'input',
      name: 'host',
      message: theme.secondary('Source IMAP server:'),
      validate: (input: string) => (input.trim() ? true : 'Required'),
    },
    {
      type: 'number',
      name: 'port',
      message: theme.secondary('Source IMAP port:'),
      default: 993,
    },
    {
      type: 'confirm',
      name: 'ssl',
      message: 'Use SSL?',
      default: true,
    },
  ]);

  // Step 2: Accounts to migrate
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Migration mode:',
      choices: [
        { name: 'Single account', value: 'single' },
        { name: 'Multiple accounts (one at a time)', value: 'multiple' },
      ],
    },
  ]);

  interface MigrationAccount {
    sourceUser: string;
    sourcePass: string;
    destUser: string;
    destDomain: string;
  }

  const accounts: MigrationAccount[] = [];

  if (mode === 'single') {
    const acc = await inquirer.prompt([
      {
        type: 'input',
        name: 'sourceUser',
        message: theme.secondary('Source email address:'),
        validate: (i: string) => (i.includes('@') ? true : 'Enter full email'),
      },
      { type: 'password', name: 'sourcePass', message: theme.secondary('Source password:'), mask: '•' },
      {
        type: 'input',
        name: 'destEmail',
        message: theme.secondary('Destination email on MXroute:'),
        validate: (i: string) => (i.includes('@') ? true : 'Enter full email'),
      },
    ]);
    const [destUser, destDomain] = acc.destEmail.split('@');
    accounts.push({ sourceUser: acc.sourceUser, sourcePass: acc.sourcePass, destUser, destDomain });
  } else {
    let addMore = true;
    while (addMore) {
      const acc = await inquirer.prompt([
        {
          type: 'input',
          name: 'sourceUser',
          message: theme.secondary('Source email:'),
          validate: (i: string) => (i.includes('@') ? true : 'Enter full email'),
        },
        { type: 'password', name: 'sourcePass', message: theme.secondary('Source password:'), mask: '•' },
        {
          type: 'input',
          name: 'destEmail',
          message: theme.secondary('Destination email on MXroute:'),
          validate: (i: string) => (i.includes('@') ? true : 'Enter full email'),
        },
      ]);
      const [destUser, destDomain] = acc.destEmail.split('@');
      accounts.push({ sourceUser: acc.sourceUser, sourcePass: acc.sourcePass, destUser, destDomain });

      const { more } = await inquirer.prompt([
        { type: 'confirm', name: 'more', message: 'Add another account?', default: false },
      ]);
      addMore = more;
    }
  }

  // Step 3: Show plan
  console.log(theme.heading('Migration Plan'));
  console.log(theme.keyValue('Source Server', `${source.host}:${source.port} (${source.ssl ? 'SSL' : 'plain'})`));
  console.log(theme.keyValue('Destination', `${config.server}.mxrouting.net:993 (SSL)`));
  console.log(theme.keyValue('Accounts', `${accounts.length}`));
  console.log('');

  for (const acc of accounts) {
    console.log(theme.muted(`    ${acc.sourceUser} → ${acc.destUser}@${acc.destDomain}`));
  }
  console.log('');

  // Step 4: Pre-flight checks
  console.log(theme.subheading('Pre-flight checks'));

  for (const acc of accounts) {
    const spinner = ora({
      text: `Checking ${acc.destUser}@${acc.destDomain}...`,
      spinner: 'dots12',
      color: 'cyan',
    }).start();
    try {
      const existing = await listEmailAccounts(creds, acc.destDomain);
      if (existing.includes(acc.destUser)) {
        spinner.succeed(`${acc.destUser}@${acc.destDomain} exists on MXroute`);
      } else {
        spinner.warn(`${acc.destUser}@${acc.destDomain} does not exist — will need to create it`);
      }
    } catch {
      spinner.warn(`Could not verify ${acc.destDomain}`);
    }
  }

  // Step 5: Generate imapsync commands
  console.log(theme.heading('Migration Commands'));
  console.log(theme.muted('  Run these commands to migrate emails:\n'));

  for (const acc of accounts) {
    const destHost = `${config.server}.mxrouting.net`;
    const sslFlag = source.ssl ? '--ssl1' : '';

    console.log(theme.secondary(`  # ${acc.sourceUser} → ${acc.destUser}@${acc.destDomain}`));
    console.log(theme.muted(`  imapsync \\`));
    console.log(theme.muted(`    --host1 ${source.host} --port1 ${source.port} ${sslFlag} \\`));
    console.log(theme.muted(`    --user1 "${acc.sourceUser}" --password1 "${acc.sourcePass}" \\`));
    console.log(theme.muted(`    --host2 ${destHost} --port2 993 --ssl2 \\`));
    console.log(theme.muted(`    --user2 "${acc.destUser}@${acc.destDomain}" --password2 "DEST_PASSWORD"`));
    console.log('');
  }

  // Step 6: Post-migration checklist
  console.log(theme.heading('Post-Migration Checklist'));
  console.log(theme.muted('    1. Run the imapsync commands above'));
  console.log(theme.muted('    2. Verify emails transferred on MXroute webmail'));
  console.log(theme.muted('    3. Update DNS MX records to MXroute'));
  console.log(theme.muted(`       Run: mxroute dns setup ${accounts[0]?.destDomain || 'yourdomain.com'}`));
  console.log(theme.muted('    4. Configure SPF, DKIM, DMARC'));
  console.log(theme.muted('    5. Reconfigure all email clients'));
  console.log(
    theme.muted(
      `       Run: mxroute share ${accounts[0]?.destUser || 'user'}@${accounts[0]?.destDomain || 'domain.com'}`,
    ),
  );
  console.log(theme.muted('    6. Keep old service running during transition'));
  console.log(theme.muted('    7. Monitor with: mxroute dns watch'));
  console.log('');

  // Offer to install imapsync
  console.log(theme.info(`  ${theme.statusIcon('info')} Install imapsync: https://imapsync.lamiral.info/`));
  console.log(theme.muted('    macOS: brew install imapsync'));
  console.log(theme.muted('    Ubuntu: sudo apt install imapsync'));
  console.log(theme.muted('    Or use the web version: https://i005.lamiral.info/'));
  console.log('');
}
