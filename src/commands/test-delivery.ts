import chalk from 'chalk';
import ora from 'ora';
import { theme } from '../utils/theme';
import { sendEmail } from '../utils/api';
import { getSendingAccount } from '../utils/sending-account';

export async function testDeliveryCommand(): Promise<void> {
  const account = await getSendingAccount();

  console.log(theme.heading('Email Delivery Test'));

  const testId = Math.random().toString(36).substring(2, 10);
  const subject = `MXroute Delivery Test [${testId}]`;

  console.log(theme.keyValue('From', account.email));
  console.log(theme.keyValue('To', account.email));
  console.log(theme.keyValue('Test ID', testId));
  console.log('');

  // Step 1: Send
  const sendSpinner = ora({ text: 'Sending test email...', spinner: 'dots12', color: 'cyan' }).start();
  const startTime = Date.now();

  try {
    const result = await sendEmail({
      server: account.server,
      username: account.email,
      password: account.password,
      from: account.email,
      to: account.email,
      subject,
      body: `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #6C63FF;">Delivery Test</h2>
        <p>Test ID: <strong>${testId}</strong></p>
        <p>Sent at: <strong>${new Date().toISOString()}</strong></p>
        <p>Server: ${account.server}</p>
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
    theme.keyValue('Server', account.server, 0),
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
