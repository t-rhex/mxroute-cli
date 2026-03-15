import * as tls from 'tls';

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export interface ImapEnvelope {
  uid: number;
  seq: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  flags: string[];
  size: number;
  messageId: string;
}

export interface ImapFolder {
  name: string;
  delimiter: string;
  flags: string[];
}

export class ImapClient {
  private socket: tls.TLSSocket | null = null;
  private tagCounter = 0;
  private buffer = '';
  private responseResolve: ((lines: string[]) => void) | null = null;
  private pendingLines: string[] = [];
  private pendingTag = '';
  private connected = false;

  constructor(private config: ImapConfig) {}

  private nextTag(): string {
    this.tagCounter++;
    return `A${String(this.tagCounter).padStart(4, '0')}`;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = tls.connect(
        { host: this.config.host, port: this.config.port, servername: this.config.host },
        () => {
          this.connected = true;
        },
      );

      this.socket.setEncoding('utf-8');
      this.socket.setTimeout(30000);

      let greeted = false;

      this.socket.on('data', (data: string) => {
        this.buffer += data;
        this.processBuffer();

        // Handle initial greeting
        if (!greeted && this.buffer.includes('\r\n')) {
          greeted = true;
          this.buffer = '';
          resolve();
        }
      });

      this.socket.on('timeout', () => {
        reject(new Error('IMAP connection timed out'));
        this.disconnect();
      });

      this.socket.on('error', (err) => {
        if (!greeted) reject(err);
      });
    });
  }

  private processBuffer(): void {
    if (!this.responseResolve || !this.pendingTag) return;

    const lines = this.buffer.split('\r\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line) continue;

      if (line.startsWith(`${this.pendingTag} `)) {
        this.pendingLines.push(line);
        const resolve = this.responseResolve;
        const result = [...this.pendingLines];
        this.responseResolve = null;
        this.pendingTag = '';
        this.pendingLines = [];
        resolve(result);
        return;
      }

      this.pendingLines.push(line);
    }
  }

  private sendCommand(command: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      const tag = this.nextTag();
      this.pendingTag = tag;
      this.pendingLines = [];
      this.responseResolve = resolve;

      this.socket.write(`${tag} ${command}\r\n`);

      // Timeout for individual commands
      setTimeout(() => {
        if (this.responseResolve === resolve) {
          this.responseResolve = null;
          reject(new Error(`Command timed out: ${command.split(' ')[0]}`));
        }
      }, 30000);
    });
  }

  async login(): Promise<void> {
    const resp = await this.sendCommand(
      `LOGIN "${this.escapeQuoted(this.config.user)}" "${this.escapeQuoted(this.config.password)}"`,
    );
    const status = resp[resp.length - 1];
    if (!status.includes('OK')) {
      throw new Error('IMAP login failed. Check your email and password.');
    }
  }

  async listFolders(): Promise<ImapFolder[]> {
    const resp = await this.sendCommand('LIST "" "*"');
    const folders: ImapFolder[] = [];

    for (const line of resp) {
      if (!line.startsWith('*')) continue;
      const match = line.match(/^\* LIST \(([^)]*)\) "(.)" (.+)$/);
      if (match) {
        let name = match[3].trim();
        if (name.startsWith('"') && name.endsWith('"')) {
          name = name.slice(1, -1);
        }
        folders.push({
          name,
          delimiter: match[2],
          flags: match[1].split(' ').filter(Boolean),
        });
      }
    }

    return folders;
  }

  async selectFolder(folder: string): Promise<{ exists: number; recent: number }> {
    const resp = await this.sendCommand(`SELECT "${this.escapeQuoted(folder)}"`);
    let exists = 0;
    let recent = 0;

    for (const line of resp) {
      const existsMatch = line.match(/^\* (\d+) EXISTS/);
      if (existsMatch) exists = parseInt(existsMatch[1], 10);
      const recentMatch = line.match(/^\* (\d+) RECENT/);
      if (recentMatch) recent = parseInt(recentMatch[1], 10);
    }

    return { exists, recent };
  }

  async fetchEnvelopes(start: number, count: number): Promise<ImapEnvelope[]> {
    if (start <= 0) return [];

    const end = start;
    const begin = Math.max(1, start - count + 1);
    const range = `${begin}:${end}`;

    const resp = await this.sendCommand(`FETCH ${range} (UID FLAGS RFC822.SIZE ENVELOPE)`);

    return this.parseEnvelopes(resp);
  }

  async fetchEnvelopesByUid(uids: number[]): Promise<ImapEnvelope[]> {
    if (uids.length === 0) return [];
    const uidList = uids.join(',');
    const resp = await this.sendCommand(`UID FETCH ${uidList} (UID FLAGS RFC822.SIZE ENVELOPE)`);
    return this.parseEnvelopes(resp);
  }

  private parseEnvelopes(resp: string[]): ImapEnvelope[] {
    const envelopes: ImapEnvelope[] = [];
    const joined = resp.join('\r\n');

    // Match each FETCH response
    const fetchRegex = /\* (\d+) FETCH \(/g;
    let match;

    while ((match = fetchRegex.exec(joined)) !== null) {
      const seq = parseInt(match[1], 10);
      // Find the content after FETCH (
      const startIdx = match.index + match[0].length;

      // Extract UID
      const uidMatch = joined.substring(startIdx).match(/UID (\d+)/);
      const uid = uidMatch ? parseInt(uidMatch[1], 10) : seq;

      // Extract FLAGS
      const flagsMatch = joined.substring(startIdx).match(/FLAGS \(([^)]*)\)/);
      const flags = flagsMatch ? flagsMatch[1].split(' ').filter(Boolean) : [];

      // Extract SIZE
      const sizeMatch = joined.substring(startIdx).match(/RFC822\.SIZE (\d+)/);
      const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;

      // Extract ENVELOPE
      const envMatch = joined.substring(startIdx).match(/ENVELOPE \((.+)\)/s);
      let subject = '';
      let from = '';
      let to = '';
      let date = '';
      let messageId = '';

      if (envMatch) {
        const env = envMatch[1];
        // Parse envelope: (date subject from sender reply-to to cc bcc in-reply-to message-id)
        const parts = this.parseEnvelopeParts(env);
        date = parts[0] || '';
        subject = this.decodeHeader(parts[1] || '');
        from = this.extractAddress(parts[2] || '');
        to = this.extractAddress(parts[5] || '');
        messageId = parts[9] || '';
      }

      envelopes.push({ uid, seq, from, to, subject, date, flags, size, messageId });
    }

    return envelopes;
  }

  private parseEnvelopeParts(env: string): string[] {
    const parts: string[] = [];
    let i = 0;
    let depth = 0;
    let current = '';
    let inQuote = false;

    while (i < env.length) {
      const ch = env[i];

      if (ch === '"' && (i === 0 || env[i - 1] !== '\\')) {
        inQuote = !inQuote;
        if (!inQuote && depth === 0) {
          parts.push(current);
          current = '';
          i++;
          continue;
        }
        i++;
        continue;
      }

      if (inQuote) {
        current += ch;
        i++;
        continue;
      }

      if (ch === '(') {
        if (depth === 0 && current === '') {
          depth++;
          i++;
          continue;
        }
        depth++;
        current += ch;
        i++;
        continue;
      }

      if (ch === ')') {
        depth--;
        if (depth === 0) {
          parts.push(current);
          current = '';
          i++;
          continue;
        }
        if (depth < 0) {
          // End of envelope
          break;
        }
        current += ch;
        i++;
        continue;
      }

      if (ch === ' ' && depth === 0 && !inQuote) {
        if (current === 'NIL') {
          parts.push('');
          current = '';
        }
        i++;
        continue;
      }

      if (depth === 0 && !inQuote) {
        if (current === '' && ch === 'N' && env.substring(i, i + 3) === 'NIL') {
          parts.push('');
          i += 3;
          current = '';
          continue;
        }
      }

      current += ch;
      i++;
    }

    if (current && current !== 'NIL') {
      parts.push(current);
    }

    return parts;
  }

  private extractAddress(addressStr: string): string {
    if (!addressStr) return '';

    // Address format: ((name NIL user host)(name NIL user host))
    const match = addressStr.match(/\(?"?([^"()]*)"?\s+NIL\s+"?([^"\s()]+)"?\s+"?([^"\s()]+)"?\)?/);
    if (match) {
      const name = match[1]?.trim();
      const user = match[2]?.trim();
      const host = match[3]?.trim();
      const email = `${user}@${host}`;
      if (name && name !== 'NIL') {
        return `${this.decodeHeader(name)} <${email}>`;
      }
      return email;
    }

    return addressStr;
  }

  async fetchBody(uid: number): Promise<string> {
    const resp = await this.sendCommand(`UID FETCH ${uid} (BODY[])`);
    const joined = resp.join('\r\n');

    // Find the body content between the header and the closing paren
    const bodyMatch = joined.match(/BODY\[\] \{(\d+)\}\r\n/);
    if (bodyMatch) {
      const length = parseInt(bodyMatch[1], 10);
      const startIdx = joined.indexOf(bodyMatch[0]) + bodyMatch[0].length;
      return joined.substring(startIdx, startIdx + length);
    }

    // Fallback: try to extract between the first literal marker and closing
    const literalMatch = joined.match(/\{(\d+)\}\r\n([\s\S]+)\)\r\n/);
    if (literalMatch) {
      return literalMatch[2].substring(0, parseInt(literalMatch[1], 10));
    }

    return joined;
  }

  async search(criteria: string): Promise<number[]> {
    const resp = await this.sendCommand(`UID SEARCH ${criteria}`);
    const uids: number[] = [];

    for (const line of resp) {
      if (line.startsWith('* SEARCH')) {
        const nums = line.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean);
        for (const n of nums) {
          const uid = parseInt(n, 10);
          if (!isNaN(uid)) uids.push(uid);
        }
      }
    }

    return uids;
  }

  async setFlags(uid: number, flags: string, mode: '+' | '-' = '+'): Promise<void> {
    await this.sendCommand(`UID STORE ${uid} ${mode}FLAGS (${flags})`);
  }

  async deleteMessage(uid: number): Promise<void> {
    await this.setFlags(uid, '\\Deleted');
    await this.sendCommand('EXPUNGE');
  }

  async moveMessage(uid: number, destFolder: string): Promise<void> {
    await this.sendCommand(`UID COPY ${uid} "${this.escapeQuoted(destFolder)}"`);
    await this.deleteMessage(uid);
  }

  async createFolder(name: string): Promise<void> {
    const resp = await this.sendCommand(`CREATE "${this.escapeQuoted(name)}"`);
    const status = resp[resp.length - 1];
    if (!status.includes('OK')) {
      throw new Error(`Failed to create folder: ${name}`);
    }
  }

  async deleteFolder(name: string): Promise<void> {
    const resp = await this.sendCommand(`DELETE "${this.escapeQuoted(name)}"`);
    const status = resp[resp.length - 1];
    if (!status.includes('OK')) {
      throw new Error(`Failed to delete folder: ${name}`);
    }
  }

  async getUnreadCount(folder: string = 'INBOX'): Promise<number> {
    await this.selectFolder(folder);
    const uids = await this.search('UNSEEN');
    return uids.length;
  }

  decodeHeader(value: string): string {
    if (!value) return '';
    // Decode =?charset?encoding?text?= patterns
    return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g, (_, _charset, encoding, text) => {
      try {
        if (encoding.toUpperCase() === 'B') {
          return Buffer.from(text, 'base64').toString('utf-8');
        }
        if (encoding.toUpperCase() === 'Q') {
          const decoded = text
            .replace(/_/g, ' ')
            .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
          return decoded;
        }
      } catch {
        // fall through
      }
      return text;
    });
  }

  private sanitizeImapInput(s: string): string {
    // Reject CRLF to prevent IMAP command injection
    if (/[\r\n]/.test(s)) {
      throw new Error('Invalid input: contains newline characters');
    }
    return s;
  }

  private escapeQuoted(s: string): string {
    this.sanitizeImapInput(s);
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  async logout(): Promise<void> {
    try {
      if (this.socket && this.connected) {
        await this.sendCommand('LOGOUT');
      }
    } catch {
      // Ignore logout errors
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }
}
