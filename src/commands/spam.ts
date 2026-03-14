import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getSpamConfig, setSpamConfig } from '../utils/directadmin';
import { getCreds, pickDomain } from '../utils/shared';

export async function spamStatus(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`SpamAssassin: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching spam configuration...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const config = await getSpamConfig(creds, targetDomain);
    spinner.stop();

    const enabled = config.enabled === 'yes' || config.enabled === '1';

    console.log(theme.keyValue('Status', enabled ? chalk.green('Enabled') : chalk.red('Disabled')));
    console.log(theme.keyValue('Required Score', config.required_score || '5'));
    console.log(theme.keyValue('Spam Delivery', config.where || 'userspamfolder'));

    if (config.high_score) {
      console.log(theme.keyValue('High Score Threshold', config.high_score));
    }
    if (config.high_score_block) {
      console.log(theme.keyValue('High Score Action', config.high_score_block));
    }

    console.log('');
    console.log(theme.muted('  MXroute also has Expert Spam Filtering \u2014 manage at'));
    console.log(theme.muted('  Management Panel \u2192 Spam Filters'));
    console.log('');
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to fetch spam configuration'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function spamEnable(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Enable SpamAssassin: ${targetDomain}`));

  const spinner = ora({ text: 'Enabling SpamAssassin...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await setSpamConfig(creds, targetDomain, {
      action: 'save',
      enabled: 'yes',
      where: 'userspamfolder',
      required_score: '5',
    });

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to enable SpamAssassin'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      spinner.succeed(chalk.green(`SpamAssassin enabled for ${targetDomain}`));
      console.log(theme.muted('  Score threshold: 5 | Spam folder: userspamfolder'));
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to enable SpamAssassin'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function spamDisable(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Disable SpamAssassin: ${targetDomain}`));

  const spinner = ora({ text: 'Disabling SpamAssassin...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await setSpamConfig(creds, targetDomain, {
      action: 'save',
      enabled: 'no',
    });

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to disable SpamAssassin'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      spinner.succeed(chalk.green(`SpamAssassin disabled for ${targetDomain}`));
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to disable SpamAssassin'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function spamConfig(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Configure SpamAssassin: ${targetDomain}`));

  const answers = await inquirer.prompt([
    {
      type: 'number',
      name: 'required_score',
      message: theme.secondary('Score threshold (1-10):'),
      default: 5,
      validate: (input: number) => {
        if (isNaN(input) || input < 1 || input > 10) return 'Enter a number between 1 and 10';
        return true;
      },
    },
    {
      type: 'list',
      name: 'where',
      message: theme.secondary('Where to put spam:'),
      choices: [
        { name: 'Spam folder (recommended)', value: 'userspamfolder' },
        { name: 'Inbox (mark as spam)', value: 'inbox' },
        { name: 'Delete immediately', value: 'delete' },
      ],
      default: 'userspamfolder',
    },
    {
      type: 'number',
      name: 'high_score',
      message: theme.secondary('High score threshold (scores above this get special handling):'),
      default: 10,
      validate: (input: number) => {
        if (isNaN(input) || input < 1) return 'Enter a valid number';
        return true;
      },
    },
    {
      type: 'list',
      name: 'high_score_block',
      message: theme.secondary('High score action:'),
      choices: [
        { name: 'Move to spam folder', value: 'userspamfolder' },
        { name: 'Delete immediately', value: 'delete' },
        { name: 'Deliver to inbox', value: 'inbox' },
      ],
      default: 'delete',
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Apply SpamAssassin settings to ${targetDomain}?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({ text: 'Applying spam configuration...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await setSpamConfig(creds, targetDomain, {
      action: 'save',
      enabled: 'yes',
      required_score: answers.required_score.toString(),
      where: answers.where,
      high_score: answers.high_score.toString(),
      high_score_block: answers.high_score_block,
    });

    if (result.error && result.error !== '0') {
      spinner.fail(chalk.red('Failed to apply spam configuration'));
      console.log(theme.error(`  ${result.text || JSON.stringify(result)}\n`));
    } else {
      spinner.succeed(chalk.green(`SpamAssassin configured for ${targetDomain}`));
      console.log(
        theme.muted(
          `  Score: ${answers.required_score} | Spam: ${answers.where} | High score: ${answers.high_score} (${answers.high_score_block})`,
        ),
      );
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to apply spam configuration'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}
