import { describe, it, expect } from 'vitest';

const mime = require('../dist/utils/mime');

describe('MIME Parser', () => {
  describe('parseMessage', () => {
    it('should parse a simple text/plain message', () => {
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        'Subject: Test Subject\r\n' +
        'Date: Mon, 01 Jan 2024 12:00:00 +0000\r\n' +
        'Message-ID: <123@example.com>\r\n' +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'Hello, World!';

      const msg = mime.parseMessage(raw);
      expect(msg.from).toBe('sender@example.com');
      expect(msg.to).toBe('recipient@example.com');
      expect(msg.subject).toBe('Test Subject');
      expect(msg.date).toBe('Mon, 01 Jan 2024 12:00:00 +0000');
      expect(msg.messageId).toBe('<123@example.com>');
      expect(msg.textBody).toBe('Hello, World!');
      expect(msg.htmlBody).toBe('');
      expect(msg.attachments).toHaveLength(0);
    });

    it('should parse a text/html message', () => {
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        'Subject: HTML Test\r\n' +
        'Content-Type: text/html\r\n' +
        '\r\n' +
        '<h1>Hello</h1>';

      const msg = mime.parseMessage(raw);
      expect(msg.htmlBody).toBe('<h1>Hello</h1>');
      expect(msg.textBody).toBe('');
    });

    it('should parse multipart/alternative messages', () => {
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        'Subject: Multipart\r\n' +
        'Content-Type: multipart/alternative; boundary="boundary123"\r\n' +
        '\r\n' +
        '--boundary123\r\n' +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'Plain text body\r\n' +
        '--boundary123\r\n' +
        'Content-Type: text/html\r\n' +
        '\r\n' +
        '<p>HTML body</p>\r\n' +
        '--boundary123--';

      const msg = mime.parseMessage(raw);
      expect(msg.textBody).toBe('Plain text body');
      expect(msg.htmlBody).toBe('<p>HTML body</p>');
    });

    it('should parse base64 encoded body', () => {
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        'Subject: Base64\r\n' +
        'Content-Type: text/plain\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        Buffer.from('Hello, Base64!').toString('base64');

      const msg = mime.parseMessage(raw);
      expect(msg.textBody).toBe('Hello, Base64!');
    });

    it('should parse quoted-printable encoded body', () => {
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        'Subject: QP\r\n' +
        'Content-Type: text/plain\r\n' +
        'Content-Transfer-Encoding: quoted-printable\r\n' +
        '\r\n' +
        'Hello=20World';

      const msg = mime.parseMessage(raw);
      expect(msg.textBody).toBe('Hello World');
    });

    it('should decode RFC 2047 encoded headers (Base64)', () => {
      const encoded = `=?utf-8?B?${Buffer.from('Héllo Wörld').toString('base64')}?=`;
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        `Subject: ${encoded}\r\n` +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'body';

      const msg = mime.parseMessage(raw);
      expect(msg.subject).toBe('Héllo Wörld');
    });

    it('should decode RFC 2047 encoded headers (Q-encoding)', () => {
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        'Subject: =?utf-8?Q?Hello_World?=\r\n' +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'body';

      const msg = mime.parseMessage(raw);
      expect(msg.subject).toBe('Hello World');
    });

    it('should parse In-Reply-To header', () => {
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        'Subject: Re: Test\r\n' +
        'In-Reply-To: <original@example.com>\r\n' +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'Reply body';

      const msg = mime.parseMessage(raw);
      expect(msg.inReplyTo).toBe('<original@example.com>');
    });

    it('should handle folded headers', () => {
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        'Subject: This is a very long\r\n' +
        ' subject line\r\n' +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'body';

      const msg = mime.parseMessage(raw);
      expect(msg.subject).toBe('This is a very long subject line');
    });

    it('should parse attachments in multipart/mixed', () => {
      const attachmentContent = Buffer.from('file content here');
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        'Subject: With Attachment\r\n' +
        'Content-Type: multipart/mixed; boundary="mixboundary"\r\n' +
        '\r\n' +
        '--mixboundary\r\n' +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'Message body\r\n' +
        '--mixboundary\r\n' +
        'Content-Type: application/pdf; name="doc.pdf"\r\n' +
        'Content-Disposition: attachment; filename="doc.pdf"\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        attachmentContent.toString('base64') +
        '\r\n' +
        '--mixboundary--';

      const msg = mime.parseMessage(raw);
      expect(msg.textBody).toBe('Message body');
      expect(msg.attachments).toHaveLength(1);
      expect(msg.attachments[0].filename).toBe('doc.pdf');
      expect(msg.attachments[0].contentType).toBe('application/pdf');
      expect(msg.attachments[0].size).toBe(attachmentContent.length);
    });

    it('should handle CC header', () => {
      const raw =
        'From: sender@example.com\r\n' +
        'To: recipient@example.com\r\n' +
        'Cc: cc1@example.com, cc2@example.com\r\n' +
        'Subject: CC Test\r\n' +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'body';

      const msg = mime.parseMessage(raw);
      expect(msg.cc).toBe('cc1@example.com, cc2@example.com');
    });
  });

  describe('htmlToText', () => {
    it('should strip HTML tags', () => {
      const result = mime.htmlToText('<p>Hello <b>World</b></p>');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('<b>');
    });

    it('should convert <br> to newlines', () => {
      const result = mime.htmlToText('Line 1<br>Line 2<br/>Line 3');
      expect(result).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should decode HTML entities', () => {
      const result = mime.htmlToText('&amp; &lt; &gt; &quot; &#39;');
      expect(result).toBe('& < > " \'');
    });

    it('should convert &nbsp; to space', () => {
      const result = mime.htmlToText('Hello&nbsp;World');
      expect(result).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(mime.htmlToText('')).toBe('');
    });

    it('should collapse multiple newlines', () => {
      const result = mime.htmlToText('<p>A</p><p></p><p></p><p>B</p>');
      expect(result).not.toMatch(/\n{3,}/);
    });
  });

  describe('buildMimeMessage', () => {
    it('should build a simple text message', () => {
      const result = mime.buildMimeMessage({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        textBody: 'Hello',
      });

      expect(result).toContain('From: sender@example.com');
      expect(result).toContain('To: recipient@example.com');
      expect(result).toContain('Subject: Test');
      expect(result).toContain('Content-Type: text/plain; charset=utf-8');
      expect(result).toContain('MIME-Version: 1.0');
    });

    it('should build a message with CC and BCC', () => {
      const result = mime.buildMimeMessage({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        subject: 'Test',
        textBody: 'Hello',
      });

      expect(result).toContain('Cc: cc@example.com');
      expect(result).toContain('Bcc: bcc@example.com');
    });

    it('should build a multipart/alternative for HTML', () => {
      const result = mime.buildMimeMessage({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        textBody: 'Plain',
        htmlBody: '<p>HTML</p>',
      });

      expect(result).toContain('multipart/alternative');
      expect(result).toContain('text/plain');
      expect(result).toContain('text/html');
    });

    it('should encode non-ASCII subjects', () => {
      const result = mime.buildMimeMessage({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Héllo',
        textBody: 'Hello',
      });

      expect(result).toContain('=?utf-8?B?');
    });

    it('should include In-Reply-To and References headers', () => {
      const result = mime.buildMimeMessage({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Re: Test',
        textBody: 'Reply',
        inReplyTo: '<original@example.com>',
        references: '<original@example.com>',
      });

      expect(result).toContain('In-Reply-To: <original@example.com>');
      expect(result).toContain('References: <original@example.com>');
    });

    it('should generate Message-ID and Date headers', () => {
      const result = mime.buildMimeMessage({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        textBody: 'Hello',
      });

      expect(result).toContain('Message-ID: <');
      expect(result).toContain('Date: ');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(mime.formatFileSize(500)).toBe('500B');
    });

    it('should format kilobytes', () => {
      expect(mime.formatFileSize(2048)).toBe('2.0KB');
    });

    it('should format megabytes', () => {
      expect(mime.formatFileSize(1536 * 1024)).toBe('1.5MB');
    });
  });
});
