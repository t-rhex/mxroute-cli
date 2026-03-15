import * as fs from 'fs';
import * as path from 'path';

export interface MimeMessage {
  headers: Record<string, string>;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  messageId: string;
  inReplyTo: string;
  contentType: string;
  textBody: string;
  htmlBody: string;
  attachments: MimeAttachment[];
}

export interface MimeAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
}

/**
 * Parse a raw email message into structured parts.
 */
export function parseMessage(raw: string): MimeMessage {
  const msg: MimeMessage = {
    headers: {},
    from: '',
    to: '',
    cc: '',
    subject: '',
    date: '',
    messageId: '',
    inReplyTo: '',
    contentType: '',
    textBody: '',
    htmlBody: '',
    attachments: [],
  };

  // Split headers from body
  const headerEnd = raw.indexOf('\r\n\r\n');
  const headerPart = headerEnd >= 0 ? raw.substring(0, headerEnd) : raw;
  const bodyPart = headerEnd >= 0 ? raw.substring(headerEnd + 4) : '';

  // Parse headers (handle folded headers)
  const unfolded = headerPart.replace(/\r\n([ \t])/g, ' ');
  const headerLines = unfolded.split('\r\n');

  for (const line of headerLines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const key = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();
    msg.headers[key] = value;
  }

  msg.from = decodeHeaderValue(msg.headers['from'] || '');
  msg.to = decodeHeaderValue(msg.headers['to'] || '');
  msg.cc = decodeHeaderValue(msg.headers['cc'] || '');
  msg.subject = decodeHeaderValue(msg.headers['subject'] || '');
  msg.date = msg.headers['date'] || '';
  msg.messageId = msg.headers['message-id'] || '';
  msg.inReplyTo = msg.headers['in-reply-to'] || '';
  msg.contentType = msg.headers['content-type'] || 'text/plain';

  // Parse body
  const boundary = extractBoundary(msg.contentType);

  if (boundary) {
    parseMimeParts(bodyPart, boundary, msg);
  } else {
    const encoding = (msg.headers['content-transfer-encoding'] || '').toLowerCase();
    const decoded = decodeBody(bodyPart, encoding);

    if (msg.contentType.toLowerCase().includes('text/html')) {
      msg.htmlBody = decoded;
    } else {
      msg.textBody = decoded;
    }
  }

  return msg;
}

function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary="?([^";\s]+)"?/i);
  return match ? match[1] : null;
}

function parseMimeParts(body: string, boundary: string, msg: MimeMessage, depth: number = 0): void {
  if (depth > 10) return; // Prevent recursive DoS
  const parts = body.split(`--${boundary}`);

  for (const part of parts) {
    if (part.startsWith('--') || !part.trim()) continue;

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd < 0) continue;

    const partHeaders = part.substring(0, headerEnd);
    const partBody = part.substring(headerEnd + 4).replace(/\r\n$/, '');

    const headers: Record<string, string> = {};
    const unfolded = partHeaders.replace(/\r\n([ \t])/g, ' ');
    for (const line of unfolded.split('\r\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) continue;
      headers[line.substring(0, colonIdx).trim().toLowerCase()] = line.substring(colonIdx + 1).trim();
    }

    const ct = (headers['content-type'] || 'text/plain').toLowerCase();
    const encoding = (headers['content-transfer-encoding'] || '').toLowerCase();
    const disposition = (headers['content-disposition'] || '').toLowerCase();

    // Check for nested multipart
    const nestedBoundary = extractBoundary(ct);
    if (nestedBoundary) {
      parseMimeParts(partBody, nestedBoundary, msg, depth + 1);
      continue;
    }

    // Attachment
    if (disposition.includes('attachment') || disposition.includes('filename') || ct.includes('name=')) {
      const filenameMatch = disposition.match(/filename="?([^";\r\n]+)"?/i) || ct.match(/name="?([^";\r\n]+)"?/i);
      const filename = filenameMatch ? decodeHeaderValue(filenameMatch[1].trim()) : 'attachment';

      const content =
        encoding === 'base64'
          ? Buffer.from(partBody.replace(/\s/g, ''), 'base64')
          : Buffer.from(decodeBody(partBody, encoding), 'binary');

      msg.attachments.push({
        filename,
        contentType: ct.split(';')[0].trim(),
        size: content.length,
        content,
      });
      continue;
    }

    // Text parts
    const decoded = decodeBody(partBody, encoding);

    if (ct.includes('text/html')) {
      msg.htmlBody = decoded;
    } else if (ct.includes('text/plain')) {
      msg.textBody = decoded;
    }
  }
}

function decodeBody(body: string, encoding: string): string {
  if (encoding === 'base64') {
    try {
      return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf-8');
    } catch {
      return body;
    }
  }

  if (encoding === 'quoted-printable') {
    return body
      .replace(/=\r\n/g, '') // soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  return body;
}

function decodeHeaderValue(value: string): string {
  if (!value) return '';
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g, (_, _charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString('utf-8');
      }
      if (encoding.toUpperCase() === 'Q') {
        return text
          .replace(/_/g, ' ')
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      }
    } catch {
      // fall through
    }
    return text;
  });
}

/**
 * Strip HTML tags and return plain text.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Build a MIME message with optional attachments.
 */
export function buildMimeMessage(options: {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: { filename: string; path: string }[];
}): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const hasAttachments = options.attachments && options.attachments.length > 0;
  const hasHtml = !!options.htmlBody;

  const headers: string[] = [`From: ${options.from}`, `To: ${options.to}`];

  if (options.cc) headers.push(`Cc: ${options.cc}`);
  if (options.bcc) headers.push(`Bcc: ${options.bcc}`);

  headers.push(`Subject: ${encodeMimeHeader(options.subject)}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push(`Message-ID: <${Date.now()}.${Math.random().toString(36).substring(2)}@mxroute-cli>`);
  headers.push('MIME-Version: 1.0');

  if (options.inReplyTo) headers.push(`In-Reply-To: ${options.inReplyTo}`);
  if (options.references) headers.push(`References: ${options.references}`);

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  } else if (hasHtml) {
    const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);

    const bodyParts: string[] = [];

    if (options.textBody) {
      bodyParts.push(
        `--${altBoundary}\r\n` +
          `Content-Type: text/plain; charset=utf-8\r\n` +
          `Content-Transfer-Encoding: quoted-printable\r\n\r\n` +
          encodeQuotedPrintable(options.textBody),
      );
    }

    bodyParts.push(
      `--${altBoundary}\r\n` +
        `Content-Type: text/html; charset=utf-8\r\n` +
        `Content-Transfer-Encoding: quoted-printable\r\n\r\n` +
        encodeQuotedPrintable(options.htmlBody!),
    );

    bodyParts.push(`--${altBoundary}--`);

    return headers.join('\r\n') + '\r\n\r\n' + bodyParts.join('\r\n');
  } else {
    headers.push('Content-Type: text/plain; charset=utf-8');
    headers.push('Content-Transfer-Encoding: quoted-printable');
    return headers.join('\r\n') + '\r\n\r\n' + encodeQuotedPrintable(options.textBody || '');
  }

  // Build multipart/mixed with attachments
  const bodyParts: string[] = [];

  // Text/HTML body part
  if (hasHtml) {
    const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    let altPart = `--${boundary}\r\n` + `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;

    if (options.textBody) {
      altPart +=
        `--${altBoundary}\r\n` +
        `Content-Type: text/plain; charset=utf-8\r\n` +
        `Content-Transfer-Encoding: quoted-printable\r\n\r\n` +
        encodeQuotedPrintable(options.textBody) +
        '\r\n';
    }

    altPart +=
      `--${altBoundary}\r\n` +
      `Content-Type: text/html; charset=utf-8\r\n` +
      `Content-Transfer-Encoding: quoted-printable\r\n\r\n` +
      encodeQuotedPrintable(options.htmlBody!) +
      '\r\n';

    altPart += `--${altBoundary}--`;
    bodyParts.push(altPart);
  } else {
    bodyParts.push(
      `--${boundary}\r\n` +
        `Content-Type: text/plain; charset=utf-8\r\n` +
        `Content-Transfer-Encoding: quoted-printable\r\n\r\n` +
        encodeQuotedPrintable(options.textBody || ''),
    );
  }

  // Attachment parts
  if (options.attachments) {
    for (const att of options.attachments) {
      const content = fs.readFileSync(att.path);
      const base64 = content.toString('base64');
      const mimeType = guessMimeType(att.filename);

      // Break base64 into 76-char lines
      const lines: string[] = [];
      for (let i = 0; i < base64.length; i += 76) {
        lines.push(base64.substring(i, i + 76));
      }

      bodyParts.push(
        `--${boundary}\r\n` +
          `Content-Type: ${mimeType}; name="${att.filename}"\r\n` +
          `Content-Disposition: attachment; filename="${att.filename}"\r\n` +
          `Content-Transfer-Encoding: base64\r\n\r\n` +
          lines.join('\r\n'),
      );
    }
  }

  bodyParts.push(`--${boundary}--`);

  return headers.join('\r\n') + '\r\n\r\n' + bodyParts.join('\r\n');
}

function encodeMimeHeader(value: string): string {
  // Only encode if non-ASCII
  if (/^[\x20-\x7E]+$/.test(value)) return value;
  return `=?utf-8?B?${Buffer.from(value).toString('base64')}?=`;
}

function encodeQuotedPrintable(text: string): string {
  return text
    .replace(/[^\r\n\t\x20-\x7E]/g, (ch) => {
      const buf = Buffer.from(ch);
      return Array.from(buf)
        .map((b) => `=${b.toString(16).toUpperCase().padStart(2, '0')}`)
        .join('');
    })
    .replace(/(.{73})/g, '$1=\r\n'); // Soft line breaks at 76 chars
}

function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.gz': 'application/gzip',
    '.tar': 'application/x-tar',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.wav': 'audio/wav',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.csv': 'text/csv',
    '.ics': 'text/calendar',
    '.eml': 'message/rfc822',
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Format a file size in human-readable form.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
