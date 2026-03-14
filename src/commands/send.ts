import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { sendEmail } from '../utils/api';

interface SendOptions {
  to?: string;
  subject?: string;
  body?: string;
  html?: boolean;
  from?: string;
}

export async function sendCommand(options: SendOptions): Promise<void> {
  console.log(theme.heading('Send Email'));

  const config = getConfig();

  if (!config.server || !config.username || !config.password) {
    console.log(
      theme.error(`  ${theme.statusIcon('fail')} Not configured. Run ${theme.bold('mxroute config smtp')} first.\n`),
    );
    process.exit(1);
  }

  const answers: any = {};

  if (!options.to) {
    const res = await inquirer.prompt([
      {
        type: 'input',
        name: 'to',
        message: theme.secondary('To:'),
        validate: (input: string) => (input.includes('@') ? true : 'Enter a valid email address'),
      },
    ]);
    answers.to = res.to;
  }

  if (!options.subject) {
    const res = await inquirer.prompt([
      {
        type: 'input',
        name: 'subject',
        message: theme.secondary('Subject:'),
        validate: (input: string) => (input.trim() ? true : 'Subject is required'),
      },
    ]);
    answers.subject = res.subject;
  }

  if (!options.body) {
    const res = await inquirer.prompt([
      {
        type: 'editor',
        name: 'body',
        message: theme.secondary('Body (opens editor):'),
      },
    ]);
    answers.body = res.body;
  }

  const to = options.to || answers.to;
  const subject = options.subject || answers.subject;
  const body = options.body || answers.body;
  const from = options.from || config.username;

  console.log('');
  console.log(
    theme.box(
      [
        theme.keyValue('From', from, 0),
        theme.keyValue('To', to, 0),
        theme.keyValue('Subject', subject, 0),
        theme.keyValue('Body', body.length > 50 ? body.substring(0, 50) + '...' : body, 0),
      ].join('\n'),
      'Email Preview',
    ),
  );

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Send this email?',
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(theme.warning('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({
    text: 'Sending email...',
    spinner: 'dots12',
    color: 'cyan',
  }).start();

  try {
    const result = await sendEmail({
      server: `${config.server}.mxrouting.net`,
      username: config.username,
      password: config.password,
      from,
      to,
      subject,
      body: options.html
        ? body
        : `<div style="font-family: sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br>')}</div>`,
    });

    if (result.success) {
      spinner.succeed(chalk.green('Email sent successfully!'));
      console.log(theme.muted(`  ${result.message}\n`));
    } else {
      spinner.fail(chalk.red('Failed to send email'));
      console.log(theme.error(`  ${result.message}\n`));
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to send email'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}
