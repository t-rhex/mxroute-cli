import fetch from 'node-fetch';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig, setConfig } from '../utils/config';

interface NotifyChannel {
  type: 'slack' | 'discord' | 'telegram' | 'email';
  webhook?: string;
  chatId?: string;
  botToken?: string;
}

export async function notifySetup(): Promise<void> {
  console.log(theme.heading('Notification Setup'));
  console.log(theme.muted('  Configure where to send monitoring alerts.\n'));

  const { channel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'channel',
      message: 'Notification channel:',
      choices: [
        { name: 'Slack (webhook URL)', value: 'slack' },
        { name: 'Discord (webhook URL)', value: 'discord' },
        { name: 'Telegram (bot token + chat ID)', value: 'telegram' },
        { name: 'Email (uses configured SMTP)', value: 'email' },
      ],
    },
  ]);

  const notifyConfig: NotifyChannel = { type: channel };

  if (channel === 'slack' || channel === 'discord') {
    const { webhook } = await inquirer.prompt([
      {
        type: 'input',
        name: 'webhook',
        message: theme.secondary(`${channel === 'slack' ? 'Slack' : 'Discord'} webhook URL:`),
        validate: (input: string) => (input.startsWith('http') ? true : 'Enter a valid URL'),
      },
    ]);
    notifyConfig.webhook = webhook;
  } else if (channel === 'telegram') {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'botToken',
        message: theme.secondary('Telegram Bot Token:'),
        validate: (i: string) => (i.trim() ? true : 'Required'),
      },
      {
        type: 'input',
        name: 'chatId',
        message: theme.secondary('Chat ID:'),
        validate: (i: string) => (i.trim() ? true : 'Required'),
      },
    ]);
    notifyConfig.botToken = answers.botToken;
    notifyConfig.chatId = answers.chatId;
  }

  // Test notification
  const { test } = await inquirer.prompt([
    { type: 'confirm', name: 'test', message: 'Send a test notification?', default: true },
  ]);

  if (test) {
    const success = await sendNotification(
      notifyConfig,
      'MXroute CLI',
      'Test notification — monitoring alerts are configured!',
    );
    if (success) {
      console.log(theme.success(`\n  ${theme.statusIcon('pass')} Test notification sent!`));
    } else {
      console.log(theme.error(`\n  ${theme.statusIcon('fail')} Failed to send test notification.`));
    }
  }

  setConfig('notify', notifyConfig);
  console.log(theme.success(`\n  ${theme.statusIcon('pass')} Notification channel saved.\n`));
  console.log(theme.muted(`  Alerts will be sent when running: mxroute monitor --alert\n`));
}

export async function notifyTest(): Promise<void> {
  const config = getConfig();
  const notifyConfig = (config as any).notify as NotifyChannel;

  if (!notifyConfig) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} No notification channel configured. Run ${theme.bold('mxroute notify setup')}\n`,
      ),
    );
    return;
  }

  console.log(theme.muted(`\n  Sending test to ${notifyConfig.type}...`));
  const success = await sendNotification(notifyConfig, 'MXroute CLI', 'Test notification from mxroute-cli');
  if (success) {
    console.log(theme.success(`  ${theme.statusIcon('pass')} Sent!\n`));
  } else {
    console.log(theme.error(`  ${theme.statusIcon('fail')} Failed.\n`));
  }
}

export async function sendNotification(channel: NotifyChannel, title: string, message: string): Promise<boolean> {
  try {
    switch (channel.type) {
      case 'slack':
        return await sendSlack(channel.webhook!, title, message);
      case 'discord':
        return await sendDiscord(channel.webhook!, title, message);
      case 'telegram':
        return await sendTelegram(channel.botToken!, channel.chatId!, title, message);
      case 'email':
        return true; // Handled by monitor command directly
      default:
        return false;
    }
  } catch {
    return false;
  }
}

async function sendSlack(webhook: string, title: string, message: string): Promise<boolean> {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `*${title}*\n${message}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: title } },
        { type: 'section', text: { type: 'mrkdwn', text: message } },
      ],
    }),
  });
  return res.ok;
}

async function sendDiscord(webhook: string, title: string, message: string): Promise<boolean> {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title,
          description: message,
          color: 0xff5252,
          footer: { text: 'mxroute-cli monitor' },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  return res.ok;
}

async function sendTelegram(botToken: string, chatId: string, title: string, message: string): Promise<boolean> {
  const text = `*${title}*\n${message}`;
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  const data = (await res.json()) as any;
  return data.ok === true;
}
