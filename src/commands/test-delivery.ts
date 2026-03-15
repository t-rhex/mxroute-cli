import chalk from 'chalk';
import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { sendEmail } from '../utils/api';

export async function testDeliveryCommand(): Promise<void> {
  const config = getConfig();

  if (!config.server || !config.username || !config.password) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} SMTP not configured. Run ${theme.bold('mxroute config smtp')} first.\n`,
      ),
    );
    process.exit(1);
  }

  console.log(theme.heading('Email Delivery Test'));

  const testId = Math.random().toString(36).substring(2, 10);
  const subject = `MXroute Delivery Test [${testId}]`;

  console.log(theme.keyValue('From', config.username));
  console.log(theme.keyValue('To', config.username));
  console.log(theme.keyValue('Test ID', testId));
  console.log('');

  // Step 1: Send
  const sendSpinner = ora({ text: 'Sending test email...', spinner: 'dots12', color: 'cyan' }).start();
  const startTime = Date.now();

  try {
    const result = await sendEmail({
      server: `${config.server}.mxrouting.net`,
      username: config.username,
      password: config.password,
      from: config.username,
      to: config.username,
      subject,
      body: `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #6C63FF;">Delivery Test</h2>
        <p>Test ID: <strong>${testId}</strong></p>
        <p>Sent at: <strong>${new Date().toISOString()}</strong></p>
        <p>Server: ${config.server}.mxrouting.net</p>
        <hr style="border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">This is an automated delivery test from the MXroute CLI.</p>
      </div>`,
    });

    const sendTime = Date.now() - startTime;

    if (result.success) {
      sendSpinner.succeed(chalk.green(`Email sent in ${sendTime}ms`));
    } else {
      sendSpinner.fail(chalk.red(`Send failed: ${result.message}`));
      return;
    }
  } catch (err: any) {
    sendSpinner.fail(chalk.red(`Send failed: ${err.message}`));
    return;
  }

  const sendDuration = Date.now() - startTime;

  // Step 2: Results
  console.log('');
  const lines = [
    theme.keyValue('Status', chalk.green('Sent successfully'), 0),
    theme.keyValue('Send Time', `${sendDuration}ms`, 0),
    theme.keyValue('Test ID', testId, 0),
    theme.keyValue('Server', `${config.server}.mxrouting.net`, 0),
  ];

  let rating = 'Excellent';
  let ratingColor = theme.success;
  if (sendDuration > 5000) {
    rating = 'Slow';
    ratingColor = theme.error;
  } else if (sendDuration > 2000) {
    rating = 'Average';
    ratingColor = theme.warning;
  } else if (sendDuration > 1000) {
    rating = 'Good';
    ratingColor = theme.success;
  }

  lines.push(theme.keyValue('Rating', ratingColor(rating), 0));

  console.log(theme.box(lines.join('\n'), 'Delivery Results'));
  console.log('');
  console.log(theme.muted('  Check your inbox for the test email.'));
  console.log(theme.muted(`  Subject: "${subject}"\n`));
}
