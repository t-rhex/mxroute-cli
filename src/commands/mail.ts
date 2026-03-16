import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as tls from 'tls';
import { theme } from '../utils/theme';
import { ImapClient, ImapConfig } from '../utils/imap';
import { parseMessage, htmlToText, buildMimeMessage, formatFileSize } from '../utils/mime';
import { getSendingAccount } from '../utils/sending-account';

async function getImapConfig(): Promise<ImapConfig> {
  const account = await getSendingAccount();
  return {
    host: account.server,
    port: 993,
    user: account.email,
    password: account.password,
  };
}

async function withImap<T>(fn: (client: ImapClient) => Promise<T>): Promise<T> {
  const imapConfig = await getImapConfig();
  const client = new ImapClient(imapConfig);

  try {
    await client.connect();
    await client.login();
    return await fn(client);
  } finally {
    await client.logout();
    client.disconnect();
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr.substring(0, 16);
  }
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.substring(0, len - 1) + '\u2026';
}

function sanitizeSmtpValue(s: string): string {
  if (/[\r\n]/.test(s)) {
    throw new Error('Invalid input: contains newline characters');
  }
  return s;
}

function extractEmail(addr: string): string {
  const match = addr.match(/<([^>]+)>/);
  return sanitizeSmtpValue(match ? match[1] : addr);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractName(addr: string): string {
  const match = addr.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return addr.split('@')[0];
}

// ─── Inbox ──────────────────────────────────────────────

export async function mailInbox(folder?: string): Promise<void> {
  const targetFolder = folder || 'INBOX';

  console.log(theme.heading(`Mail: ${targetFolder}`));

  const spinner = ora({ text: 'Connecting to mailbox...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      const info = await client.selectFolder(targetFolder);
      spinner.text = `Fetching messages (${info.exists} total)...`;

      if (info.exists === 0) {
        spinner.stop();
        console.log(theme.muted('  No messages in this folder.\n'));
        return;
      }

      const count = Math.min(info.exists, 25);
      const envelopes = await client.fetchEnvelopes(info.exists, count);
      spinner.stop();

      // Sort newest first
      envelopes.sort((a, b) => b.seq - a.seq);

      console.log(theme.muted(`  Showing ${envelopes.length} of ${info.exists} messages (${info.recent} new)\n`));

      for (const env of envelopes) {
        const isUnread = !env.flags.includes('\\Seen');
        const isFlagged = env.flags.includes('\\Flagged');

        const marker = isUnread ? chalk.cyan('\u25cf') : ' ';
        const flag = isFlagged ? chalk.yellow('\u2605') : ' ';
        const uid = theme.muted(`#${env.uid}`);
        const from = truncate(extractName(env.from), 20).padEnd(20);
        const subject = truncate(env.subject || '(no subject)', 45);
        const date = formatDate(env.date);
        const size = theme.muted(formatFileSize(env.size));

        const fromFormatted = isUnread ? chalk.bold.white(from) : theme.muted(from);
        const subjectFormatted = isUnread ? chalk.white(subject) : theme.muted(subject);

        console.log(
          `  ${marker} ${flag} ${uid.padEnd(14)} ${fromFormatted} ${subjectFormatted}  ${theme.muted(date)}  ${size}`,
        );
      }

      console.log('');
      console.log(theme.muted(`  Read: ${theme.bold('mxroute mail read <uid>')}`));
      console.log(theme.muted(`  Unread: ${envelopes.filter((e) => !e.flags.includes('\\Seen')).length} messages\n`));
    });
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to fetch inbox'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

// ─── Read ───────────────────────────────────────────────

export async function mailRead(uid?: string): Promise<void> {
  if (!uid) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Usage: mxroute mail read <uid>\n`));
    process.exit(1);
  }

  const uidNum = parseInt(uid, 10);
  if (isNaN(uidNum)) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Invalid message UID.\n`));
    process.exit(1);
  }

  const spinner = ora({ text: 'Fetching message...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      await client.selectFolder('INBOX');

      // Mark as read
      await client.setFlags(uidNum, '\\Seen');

      const rawBody = await client.fetchBody(uidNum);
      spinner.stop();

      const msg = parseMessage(rawBody);

      // Header
      console.log(theme.heading('Message'));
      console.log(theme.keyValue('From', msg.from));
      console.log(theme.keyValue('To', msg.to));
      if (msg.cc) console.log(theme.keyValue('Cc', msg.cc));
      console.log(theme.keyValue('Date', msg.date));
      console.log(theme.keyValue('Subject', msg.subject));

      if (msg.attachments.length > 0) {
        const attList = msg.attachments.map((a) => `${a.filename} (${formatFileSize(a.size)})`).join(', ');
        console.log(theme.keyValue('Attachments', attList));
      }

      console.log(theme.separator());
      console.log('');

      // Body
      const body = msg.textBody || htmlToText(msg.htmlBody) || '(empty message)';
      const lines = body.split('\n');
      for (const line of lines) {
        if (line.startsWith('>')) {
          console.log(theme.muted(`    ${line}`));
        } else {
          console.log(`    ${line}`);
        }
      }

      console.log('');

      if (msg.attachments.length > 0) {
        console.log(theme.muted(`  ${msg.attachments.length} attachment${msg.attachments.length === 1 ? '' : 's'}:`));
        for (const att of msg.attachments) {
          console.log(theme.muted(`    \u2022 ${att.filename} (${formatFileSize(att.size)})`));
        }
        console.log(theme.muted(`  Save with: ${theme.bold(`mxroute mail save-attachment ${uidNum}`)}\n`));
      }

      // Actions
      console.log(theme.muted(`  Reply: ${theme.bold(`mxroute mail reply ${uidNum}`)}`));
      console.log(theme.muted(`  Forward: ${theme.bold(`mxroute mail forward ${uidNum}`)}`));
      console.log(theme.muted(`  Delete: ${theme.bold(`mxroute mail delete ${uidNum}`)}\n`));
    });
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to read message'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

// ─── Compose ────────────────────────────────────────────

export async function mailCompose(): Promise<void> {
  const account = await getSendingAccount();

  console.log(theme.heading('Compose Email'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'to',
      message: theme.secondary('To:'),
      validate: (input: string) => (input.includes('@') ? true : 'Enter a valid email address'),
    },
    {
      type: 'input',
      name: 'cc',
      message: theme.secondary('Cc (optional):'),
    },
    {
      type: 'input',
      name: 'bcc',
      message: theme.secondary('Bcc (optional):'),
    },
    {
      type: 'input',
      name: 'subject',
      message: theme.secondary('Subject:'),
      validate: (input: string) => (input.trim() ? true : 'Subject is required'),
    },
    {
      type: 'confirm',
      name: 'useHtml',
      message: 'Compose as HTML?',
      default: false,
    },
    {
      type: 'editor',
      name: 'body',
      message: theme.secondary('Message body (opens editor):'),
    },
    {
      type: 'confirm',
      name: 'hasAttachments',
      message: 'Attach files?',
      default: false,
    },
  ]);

  const attachments: { filename: string; path: string }[] = [];

  if (answers.hasAttachments) {
    let addMore = true;
    while (addMore) {
      const { filePath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'filePath',
          message: theme.secondary('File path:'),
          validate: (input: string) => {
            const resolved = path.resolve(input);
            if (!fs.existsSync(resolved)) return `File not found: ${resolved}`;
            if (fs.statSync(resolved).isDirectory()) return 'Cannot attach a directory';
            return true;
          },
        },
      ]);

      const resolved = path.resolve(filePath);
      attachments.push({ filename: path.basename(resolved), path: resolved });
      console.log(theme.success(`    ${theme.statusIcon('pass')} ${path.basename(resolved)} attached`));

      const { more } = await inquirer.prompt([
        { type: 'confirm', name: 'more', message: 'Attach another file?', default: false },
      ]);
      addMore = more;
    }
  }

  // Summary
  console.log('');
  console.log(theme.keyValue('From', account.email));
  console.log(theme.keyValue('To', answers.to));
  if (answers.cc) console.log(theme.keyValue('Cc', answers.cc));
  if (answers.bcc) console.log(theme.keyValue('Bcc', answers.bcc));
  console.log(theme.keyValue('Subject', answers.subject));
  if (attachments.length > 0) {
    console.log(theme.keyValue('Attachments', attachments.map((a) => a.filename).join(', ')));
  }
  console.log('');

  const { confirm } = await inquirer.prompt([
    { type: 'confirm', name: 'confirm', message: 'Send this email?', default: true },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({ text: 'Sending...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    if (attachments.length > 0 || answers.cc || answers.bcc) {
      // Use SMTP directly for attachments/CC/BCC
      const mime = buildMimeMessage({
        from: account.email,
        to: answers.to,
        cc: answers.cc || undefined,
        bcc: answers.bcc || undefined,
        subject: answers.subject,
        textBody: answers.useHtml ? undefined : answers.body,
        htmlBody: answers.useHtml ? answers.body : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      await sendViaSMTP(account, answers.to, answers.cc, answers.bcc, mime);
      spinner.succeed(chalk.green(`Email sent to ${answers.to}`));
    } else {
      // Use SMTP API for simple messages
      const { sendEmail } = await import('../utils/api');
      const result = await sendEmail({
        server: account.server,
        username: account.email,
        password: account.password,
        from: account.email,
        to: answers.to,
        subject: answers.subject,
        body: answers.useHtml
          ? answers.body
          : `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(answers.body)}</pre>`,
      });

      if (result.success) {
        spinner.succeed(chalk.green(`Email sent to ${answers.to}`));
      } else {
        spinner.fail(chalk.red(result.message));
      }
    }
  } catch (err: any) {
    spinner.fail(chalk.red(`Send failed: ${err.message}`));
  }
  console.log('');
}

// ─── Reply ──────────────────────────────────────────────

export async function mailReply(uid?: string): Promise<void> {
  if (!uid) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Usage: mxroute mail reply <uid>\n`));
    process.exit(1);
  }

  const uidNum = parseInt(uid, 10);
  // Prompt for sending account before fetching the message so the user isn't
  // blocked mid-flow if credentials aren't configured yet.
  const account = await getSendingAccount();

  const spinner = ora({ text: 'Fetching original message...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    let originalMsg: ReturnType<typeof parseMessage> | null = null;

    await withImap(async (client) => {
      await client.selectFolder('INBOX');
      const rawBody = await client.fetchBody(uidNum);
      originalMsg = parseMessage(rawBody);
    });

    spinner.stop();

    if (!originalMsg) {
      console.log(theme.error(`\n  ${theme.statusIcon('fail')} Message not found.\n`));
      return;
    }

    const msg = originalMsg as ReturnType<typeof parseMessage>;
    const replyTo = extractEmail(msg.from);
    const replySubject = msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`;

    console.log(theme.heading('Reply'));
    console.log(theme.keyValue('To', replyTo));
    console.log(theme.keyValue('Subject', replySubject));
    console.log('');

    const { body } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'body',
        message: theme.secondary('Your reply (opens editor):'),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      { type: 'confirm', name: 'confirm', message: 'Send reply?', default: true },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const originalBody = msg.textBody || htmlToText(msg.htmlBody);
    const quoted = originalBody
      .split('\n')
      .map((l: string) => `> ${l}`)
      .join('\n');
    const fullBody = `${body.trim()}\n\nOn ${msg.date}, ${msg.from} wrote:\n${quoted}`;

    const sendSpinner = ora({ text: 'Sending reply...', spinner: 'dots12', color: 'cyan' }).start();

    try {
      const { sendEmail } = await import('../utils/api');
      const result = await sendEmail({
        server: account.server,
        username: account.email,
        password: account.password,
        from: account.email,
        to: replyTo,
        subject: replySubject,
        body: `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(fullBody)}</pre>`,
      });

      if (result.success) {
        sendSpinner.succeed(chalk.green(`Reply sent to ${replyTo}`));
      } else {
        sendSpinner.fail(chalk.red(result.message));
      }
    } catch (err: any) {
      sendSpinner.fail(chalk.red(err.message));
    }
    console.log('');
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
  }
}

// ─── Forward ────────────────────────────────────────────

export async function mailForward(uid?: string): Promise<void> {
  if (!uid) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Usage: mxroute mail forward <uid>\n`));
    process.exit(1);
  }

  const uidNum = parseInt(uid, 10);
  // Prompt for sending account before fetching the message so the user isn't
  // blocked mid-flow if credentials aren't configured yet.
  const account = await getSendingAccount();

  const spinner = ora({ text: 'Fetching original message...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    let originalMsg: ReturnType<typeof parseMessage> | null = null;

    await withImap(async (client) => {
      await client.selectFolder('INBOX');
      const rawBody = await client.fetchBody(uidNum);
      originalMsg = parseMessage(rawBody);
    });

    spinner.stop();

    if (!originalMsg) {
      console.log(theme.error(`\n  ${theme.statusIcon('fail')} Message not found.\n`));
      return;
    }

    const msg = originalMsg as ReturnType<typeof parseMessage>;

    console.log(theme.heading('Forward'));
    console.log(theme.keyValue('Subject', `Fwd: ${msg.subject}`));
    console.log('');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'to',
        message: theme.secondary('Forward to:'),
        validate: (input: string) => (input.includes('@') ? true : 'Enter a valid email address'),
      },
      {
        type: 'editor',
        name: 'note',
        message: theme.secondary('Add a note (optional, opens editor):'),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      { type: 'confirm', name: 'confirm', message: `Forward to ${answers.to}?`, default: true },
    ]);

    if (!confirm) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }

    const originalBody = msg.textBody || htmlToText(msg.htmlBody);
    const forwarded = [
      answers.note.trim() ? `${answers.note.trim()}\n\n` : '',
      '---------- Forwarded message ----------',
      `From: ${msg.from}`,
      `Date: ${msg.date}`,
      `Subject: ${msg.subject}`,
      `To: ${msg.to}`,
      '',
      originalBody,
    ].join('\n');

    const sendSpinner = ora({ text: 'Forwarding...', spinner: 'dots12', color: 'cyan' }).start();

    try {
      const { sendEmail } = await import('../utils/api');
      const result = await sendEmail({
        server: account.server,
        username: account.email,
        password: account.password,
        from: account.email,
        to: answers.to,
        subject: `Fwd: ${msg.subject}`,
        body: `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(forwarded)}</pre>`,
      });

      if (result.success) {
        sendSpinner.succeed(chalk.green(`Forwarded to ${answers.to}`));
      } else {
        sendSpinner.fail(chalk.red(result.message));
      }
    } catch (err: any) {
      sendSpinner.fail(chalk.red(err.message));
    }
    console.log('');
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
  }
}

// ─── Delete ─────────────────────────────────────────────

export async function mailDelete(uid?: string): Promise<void> {
  if (!uid) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Usage: mxroute mail delete <uid>\n`));
    process.exit(1);
  }

  const uidNum = parseInt(uid, 10);

  // Fetch subject first for confirmation
  const spinner = ora({ text: 'Fetching message...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      await client.selectFolder('INBOX');

      const envelopes = await client.fetchEnvelopesByUid([uidNum]);
      spinner.stop();

      if (envelopes.length === 0) {
        console.log(theme.error(`\n  ${theme.statusIcon('fail')} Message #${uidNum} not found.\n`));
        return;
      }

      const env = envelopes[0];
      console.log('');
      console.log(theme.keyValue('From', env.from));
      console.log(theme.keyValue('Subject', env.subject));
      console.log(theme.keyValue('Date', env.date));
      console.log('');

      const { confirm } = await inquirer.prompt([
        { type: 'confirm', name: 'confirm', message: 'Delete this message?', default: false },
      ]);

      if (!confirm) {
        console.log(theme.muted('\n  Cancelled.\n'));
        return;
      }

      const delSpinner = ora({ text: 'Deleting...', spinner: 'dots12', color: 'cyan' }).start();
      await client.deleteMessage(uidNum);
      delSpinner.succeed(chalk.green('Message deleted'));
      console.log('');
    });
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
  }
}

// ─── Search ─────────────────────────────────────────────

export async function mailSearch(query?: string): Promise<void> {
  if (!query) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Usage: mxroute mail search <query>\n`));
    process.exit(1);
  }

  console.log(theme.heading(`Search: "${query}"`));

  const spinner = ora({ text: 'Searching...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      await client.selectFolder('INBOX');

      // Sanitize search query: escape quotes and reject CRLF
      const sanitized = query.replace(/[\r\n]/g, '').replace(/"/g, '\\"');
      const criteria = `OR OR SUBJECT "${sanitized}" FROM "${sanitized}" BODY "${sanitized}"`;
      const uids = await client.search(criteria);

      if (uids.length === 0) {
        spinner.stop();
        console.log(theme.muted(`  No messages matching "${query}".\n`));
        return;
      }

      // Fetch envelopes for results (limit to 50)
      const limitedUids = uids.slice(-50);
      const envelopes = await client.fetchEnvelopesByUid(limitedUids);
      spinner.stop();

      console.log(theme.muted(`  Found ${uids.length} match${uids.length === 1 ? '' : 'es'}:\n`));

      // Sort newest first
      envelopes.sort((a, b) => b.uid - a.uid);

      for (const env of envelopes) {
        const isUnread = !env.flags.includes('\\Seen');
        const marker = isUnread ? chalk.cyan('\u25cf') : ' ';
        const uid = theme.muted(`#${env.uid}`);
        const from = truncate(extractName(env.from), 20).padEnd(20);
        const subject = truncate(env.subject || '(no subject)', 45);
        const date = formatDate(env.date);

        console.log(`  ${marker} ${uid.padEnd(14)} ${from} ${subject}  ${theme.muted(date)}`);
      }

      console.log('');
      console.log(theme.muted(`  Read: ${theme.bold('mxroute mail read <uid>')}\n`));
    });
  } catch (err: any) {
    spinner.fail(chalk.red('Search failed'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

// ─── Folders ────────────────────────────────────────────

export async function mailFolders(): Promise<void> {
  console.log(theme.heading('Mailbox Folders'));

  const spinner = ora({ text: 'Fetching folders...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      const folders = await client.listFolders();
      spinner.stop();

      if (folders.length === 0) {
        console.log(theme.muted('  No folders found.\n'));
        return;
      }

      for (const folder of folders) {
        const isSpecial = folder.flags.includes('\\Noselect') || folder.flags.includes('\\NonExistent');
        const icon = isSpecial ? theme.muted('\u25cb') : theme.statusIcon('info');
        const flags = folder.flags.length > 0 ? theme.muted(` (${folder.flags.join(', ')})`) : '';
        console.log(`  ${icon} ${theme.bold(folder.name)}${flags}`);
      }

      console.log('');
      console.log(theme.muted(`  View folder: ${theme.bold('mxroute mail inbox <folder>')}`));
      console.log(theme.muted(`  Create: ${theme.bold('mxroute mail folder-create <name>')}`));
      console.log(theme.muted(`  Delete: ${theme.bold('mxroute mail folder-delete <name>')}\n`));
    });
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to list folders'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}

export async function mailFolderCreate(name?: string): Promise<void> {
  if (!name) {
    const { folderName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'folderName',
        message: theme.secondary('Folder name:'),
        validate: (input: string) => (input.trim() ? true : 'Folder name is required'),
      },
    ]);
    name = folderName;
  }

  const spinner = ora({ text: `Creating folder "${name}"...`, spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      await client.createFolder(name!);
    });
    spinner.succeed(chalk.green(`Folder "${name}" created`));
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
  }
  console.log('');
}

export async function mailFolderDelete(name?: string): Promise<void> {
  if (!name) {
    // List folders first for selection
    try {
      const folders = await withImap(async (client) => client.listFolders());
      const selectable = folders.filter((f) => !f.flags.includes('\\Noselect') && f.name !== 'INBOX');

      if (selectable.length === 0) {
        console.log(theme.muted('\n  No deletable folders.\n'));
        return;
      }

      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Select folder to delete:',
          choices: selectable.map((f) => f.name),
        },
      ]);
      name = selected;
    } catch (err: any) {
      console.log(theme.error(`  ${err.message}\n`));
      return;
    }
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Delete folder "${name}" and all its contents?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({ text: `Deleting folder "${name}"...`, spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      await client.deleteFolder(name!);
    });
    spinner.succeed(chalk.green(`Folder "${name}" deleted`));
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
  }
  console.log('');
}

// ─── Move ───────────────────────────────────────────────

export async function mailMove(uid?: string, folder?: string): Promise<void> {
  if (!uid) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Usage: mxroute mail move <uid> <folder>\n`));
    process.exit(1);
  }

  const uidNum = parseInt(uid, 10);

  if (!folder) {
    try {
      const folders = await withImap(async (client) => client.listFolders());
      const selectable = folders.filter((f) => !f.flags.includes('\\Noselect'));

      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Move to folder:',
          choices: selectable.map((f) => f.name),
        },
      ]);
      folder = selected;
    } catch (err: any) {
      console.log(theme.error(`  ${err.message}\n`));
      return;
    }
  }

  const spinner = ora({
    text: `Moving message #${uidNum} to ${folder}...`,
    spinner: 'dots12',
    color: 'cyan',
  }).start();

  try {
    await withImap(async (client) => {
      await client.selectFolder('INBOX');
      await client.moveMessage(uidNum, folder!);
    });
    spinner.succeed(chalk.green(`Message moved to ${folder}`));
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
  }
  console.log('');
}

// ─── Save Attachment ────────────────────────────────────

export async function mailSaveAttachment(uid?: string): Promise<void> {
  if (!uid) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Usage: mxroute mail save-attachment <uid>\n`));
    process.exit(1);
  }

  const uidNum = parseInt(uid, 10);
  const spinner = ora({ text: 'Fetching message...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      await client.selectFolder('INBOX');
      const rawBody = await client.fetchBody(uidNum);
      spinner.stop();

      const msg = parseMessage(rawBody);

      if (msg.attachments.length === 0) {
        console.log(theme.muted('\n  No attachments in this message.\n'));
        return;
      }

      console.log(theme.heading(`Attachments (${msg.attachments.length})`));

      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: 'Select attachments to save:',
          choices: [
            { name: 'All attachments', value: '__ALL__' },
            ...msg.attachments.map((a, i) => ({
              name: `${a.filename} (${formatFileSize(a.size)})`,
              value: i,
            })),
          ],
        },
      ]);

      let indices: number[] = selected;
      if (selected.includes('__ALL__')) {
        indices = msg.attachments.map((_: any, i: number) => i);
      }

      if (indices.length === 0) {
        console.log(theme.muted('\n  No attachments selected.\n'));
        return;
      }

      const { outputDir } = await inquirer.prompt([
        {
          type: 'input',
          name: 'outputDir',
          message: theme.secondary('Save to directory:'),
          default: '.',
        },
      ]);

      const resolved = path.resolve(outputDir);
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }

      for (const idx of indices) {
        if (typeof idx !== 'number') continue;
        const att = msg.attachments[idx];
        // Sanitize filename to prevent path traversal
        const safeFilename = path.basename(att.filename) || 'attachment';
        const filePath = path.join(resolved, safeFilename);
        fs.writeFileSync(filePath, att.content);
        console.log(theme.success(`  ${theme.statusIcon('pass')} ${att.filename} (${formatFileSize(att.size)})`));
      }
      console.log('');
    });
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
  }
}

// ─── Unread Count ───────────────────────────────────────

export async function mailUnread(): Promise<void> {
  const spinner = ora({ text: 'Checking unread...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      const info = await client.selectFolder('INBOX');
      const unreadUids = await client.search('UNSEEN');
      spinner.stop();

      const lines = [
        theme.keyValue('Total Messages', info.exists.toString(), 0),
        theme.keyValue('Unread', unreadUids.length > 0 ? chalk.cyan.bold(unreadUids.length.toString()) : '0', 0),
        theme.keyValue('Recent', info.recent.toString(), 0),
      ];

      console.log(theme.box(lines.join('\n'), 'Inbox Status'));
      console.log('');
    });
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
  }
}

// ─── SMTP Send Helper ──────────────────────────────────

async function sendViaSMTP(
  account: { email: string; password: string; server: string },
  to: string,
  cc: string | undefined,
  bcc: string | undefined,
  mimeMessage: string,
): Promise<void> {
  const host = account.server;
  const port = 465;

  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => {
      let step = 0;
      let buffer = '';

      const allRecipients: string[] = [to];
      if (cc) allRecipients.push(...cc.split(',').map((s) => s.trim()));
      if (bcc) allRecipients.push(...bcc.split(',').map((s) => s.trim()));

      // Reject CRLF in email addresses to prevent SMTP command injection
      for (const addr of allRecipients) {
        if (/[\r\n]/.test(addr)) {
          reject(new Error('Invalid email address: contains newline characters'));
          return;
        }
      }
      let recipientIdx = 0;

      function processLine(line: string) {
        const code = parseInt(line.substring(0, 3), 10);

        // Handle multi-line responses
        if (line[3] === '-') return;

        if (step === 0 && code === 220) {
          step = 1;
          socket.write(`EHLO mxroute-cli.local\r\n`);
        } else if (step === 1 && code === 250) {
          step = 2;
          socket.write('AUTH LOGIN\r\n');
        } else if (step === 2 && code === 334) {
          step = 3;
          socket.write(Buffer.from(account.email).toString('base64') + '\r\n');
        } else if (step === 3 && code === 334) {
          step = 4;
          socket.write(Buffer.from(account.password).toString('base64') + '\r\n');
        } else if (step === 4 && code === 235) {
          step = 5;
          socket.write(`MAIL FROM:<${account.email}>\r\n`);
        } else if (step === 4 && code >= 400) {
          socket.destroy();
          reject(new Error('SMTP authentication failed'));
        } else if (step === 5 && code === 250) {
          step = 6;
          recipientIdx = 0;
          socket.write(`RCPT TO:<${extractEmail(allRecipients[recipientIdx])}>\r\n`);
        } else if (step === 6 && code === 250) {
          recipientIdx++;
          if (recipientIdx < allRecipients.length) {
            socket.write(`RCPT TO:<${extractEmail(allRecipients[recipientIdx])}>\r\n`);
          } else {
            step = 7;
            socket.write('DATA\r\n');
          }
        } else if (step === 7 && code === 354) {
          step = 8;
          socket.write(mimeMessage + '\r\n.\r\n');
        } else if (step === 8 && code === 250) {
          step = 9;
          socket.write('QUIT\r\n');
        } else if (step === 9) {
          socket.destroy();
          resolve();
        } else if (code >= 400) {
          socket.destroy();
          reject(new Error(`SMTP error ${code}: ${line}`));
        }
      }

      socket.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line) processLine(line);
        }
      });
    });

    socket.setTimeout(30000);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('SMTP connection timed out'));
    });
    socket.on('error', (err) => reject(err));
  });
}

// ─── Mark Read/Unread ───────────────────────────────────

export async function mailMarkRead(uid?: string): Promise<void> {
  if (!uid) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Usage: mxroute mail mark-read <uid>\n`));
    process.exit(1);
  }

  const uidNum = parseInt(uid, 10);
  const spinner = ora({ text: 'Marking as read...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      await client.selectFolder('INBOX');
      await client.setFlags(uidNum, '\\Seen');
    });
    spinner.succeed(chalk.green(`Message #${uidNum} marked as read`));
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
  }
  console.log('');
}

export async function mailMarkUnread(uid?: string): Promise<void> {
  if (!uid) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Usage: mxroute mail mark-unread <uid>\n`));
    process.exit(1);
  }

  const uidNum = parseInt(uid, 10);
  const spinner = ora({ text: 'Marking as unread...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    await withImap(async (client) => {
      await client.selectFolder('INBOX');
      await client.setFlags(uidNum, '\\Seen', '-');
    });
    spinner.succeed(chalk.green(`Message #${uidNum} marked as unread`));
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
  }
  console.log('');
}
