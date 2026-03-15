import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { listDomains, listDomainPointers, addDomainPointer } from '../utils/directadmin';
import { getConfig, getProfiles } from '../utils/config';

export async function aliasesSyncCommand(): Promise<void> {
  const config = getConfig();
  const profiles = getProfiles();
  const profileNames = Object.keys(profiles);

  console.log(theme.heading('Sync Domain Aliases'));

  if (profileNames.length < 2) {
    console.log(theme.muted('  Alias sync requires at least 2 profiles.'));
    console.log(theme.muted(`  Current profiles: ${profileNames.length > 0 ? profileNames.join(', ') : 'none'}`));
    console.log(theme.muted(`  Add profiles with: ${theme.bold('mxroute config setup')}\n`));
    return;
  }

  // Pick source profile
  const { sourceProfile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sourceProfile',
      message: 'Source profile (copy aliases FROM):',
      choices: profileNames,
    },
  ]);

  // Pick target profile
  const { targetProfile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'targetProfile',
      message: 'Target profile (copy aliases TO):',
      choices: profileNames.filter((p) => p !== sourceProfile),
    },
  ]);

  const source = profiles[sourceProfile];
  const target = profiles[targetProfile];

  if (!source || !target) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Invalid profile selection.\n`));
    return;
  }

  // We need DA credentials for both — check config
  if (!config.daUsername || !config.daLoginKey) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} DirectAdmin credentials required. Run ${theme.bold('mxroute config setup')} first.\n`,
      ),
    );
    return;
  }

  const sourceCreds = { server: source.server, username: config.daUsername, loginKey: config.daLoginKey };
  const targetCreds = { server: target.server, username: config.daUsername, loginKey: config.daLoginKey };

  const spinner = ora({ text: 'Fetching domains and aliases...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    // Get domains from source
    const sourceDomains = await listDomains(sourceCreds);
    const sourceAliases: Record<string, Record<string, string>> = {};

    for (const domain of sourceDomains) {
      try {
        const pointers = await listDomainPointers(sourceCreds, domain);
        if (Object.keys(pointers).length > 0) {
          sourceAliases[domain] = pointers;
        }
      } catch {
        /* skip */
      }
    }

    // Get domains from target
    const targetDomains = await listDomains(targetCreds);
    const targetAliases: Record<string, Record<string, string>> = {};

    for (const domain of targetDomains) {
      try {
        const pointers = await listDomainPointers(targetCreds, domain);
        targetAliases[domain] = pointers;
      } catch {
        /* skip */
      }
    }

    spinner.stop();

    // Find aliases that exist in source but not in target
    const toSync: { domain: string; alias: string }[] = [];
    const commonDomains = sourceDomains.filter((d) => targetDomains.includes(d));

    if (commonDomains.length === 0) {
      console.log(theme.muted('  No common domains between profiles.'));
      console.log(theme.muted(`  Source domains: ${sourceDomains.join(', ')}`));
      console.log(theme.muted(`  Target domains: ${targetDomains.join(', ')}\n`));
      return;
    }

    for (const domain of commonDomains) {
      const srcPointers = sourceAliases[domain] || {};
      const tgtPointers = targetAliases[domain] || {};

      for (const alias of Object.keys(srcPointers)) {
        if (!(alias in tgtPointers)) {
          toSync.push({ domain, alias });
        }
      }
    }

    if (toSync.length === 0) {
      console.log(
        theme.success(
          `  ${theme.statusIcon('pass')} All aliases are already in sync across ${commonDomains.length} common domain${commonDomains.length === 1 ? '' : 's'}.`,
        ),
      );
      console.log('');
      return;
    }

    console.log(theme.muted(`  Found ${toSync.length} alias${toSync.length === 1 ? '' : 'es'} to sync:\n`));

    for (const item of toSync) {
      console.log(`  ${theme.statusIcon('info')} ${theme.bold(item.alias)} \u2192 ${item.domain}`);
    }
    console.log('');

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Sync ${toSync.length} alias${toSync.length === 1 ? '' : 'es'} to ${targetProfile}?`,
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of toSync) {
      const syncSpinner = ora({
        text: `Adding ${item.alias} to ${item.domain}...`,
        spinner: 'dots12',
        color: 'cyan',
      }).start();

      try {
        const result = await addDomainPointer(targetCreds, item.domain, item.alias);
        if (result.error && result.error !== '0') {
          syncSpinner.fail(chalk.red(`${item.alias}: ${result.text || 'Failed'}`));
          failCount++;
        } else {
          syncSpinner.succeed(chalk.green(`${item.alias} \u2192 ${item.domain}`));
          successCount++;
        }
      } catch (err: any) {
        syncSpinner.fail(chalk.red(`${item.alias}: ${err.message}`));
        failCount++;
      }
    }

    console.log('');
    if (failCount === 0) {
      console.log(theme.success(`  ${theme.statusIcon('pass')} All ${successCount} aliases synced successfully!`));
    } else {
      console.log(theme.warning(`  ${successCount} synced, ${failCount} failed`));
    }
    console.log('');
  } catch (err: any) {
    spinner.fail(chalk.red('Sync failed'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}
