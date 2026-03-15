import chalk from 'chalk';
import ora from 'ora';
import * as tls from 'tls';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';

interface CertInfo {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  daysRemaining: number;
  protocol: string;
  cipher: string;
  altNames: string[];
  serialNumber: string;
  fingerprint: string;
}

function checkCert(host: string, port: number): Promise<CertInfo> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      const protocol = socket.getProtocol() || 'unknown';
      const cipher = socket.getCipher();

      if (!cert || !cert.subject) {
        socket.destroy();
        reject(new Error('No certificate returned'));
        return;
      }

      const validFrom = new Date(cert.valid_from);
      const validTo = new Date(cert.valid_to);
      const now = new Date();
      const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const altNames: string[] = cert.subjectaltname
        ? cert.subjectaltname.split(', ').map((s: string) => s.replace('DNS:', ''))
        : [];

      resolve({
        subject: String(cert.subject.CN || Object.values(cert.subject).flat().join(', ')),
        issuer: String(cert.issuer.O || cert.issuer.CN || Object.values(cert.issuer).flat().join(', ')),
        validFrom,
        validTo,
        daysRemaining,
        protocol,
        cipher: cipher ? `${cipher.name} (${cipher.version})` : 'unknown',
        altNames,
        serialNumber: cert.serialNumber || '',
        fingerprint: cert.fingerprint256 || cert.fingerprint || '',
      });

      socket.destroy();
    });

    socket.setTimeout(10000);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Connection timed out'));
    });
    socket.on('error', (err) => reject(err));
  });
}

export async function sslCheckCommand(server?: string): Promise<void> {
  const config = getConfig();
  const serverName = server || config.server;

  if (!serverName) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} No server specified. Run ${theme.bold('mxroute config setup')} or pass a server name.\n`,
      ),
    );
    process.exit(1);
  }

  const host = serverName.includes('.') ? serverName : `${serverName}.mxrouting.net`;

  console.log(theme.heading(`SSL Certificate Check: ${host}`));

  const ports = [
    { port: 993, label: 'IMAP (SSL)' },
    { port: 465, label: 'SMTP (SSL)' },
    { port: 995, label: 'POP3 (SSL)' },
    { port: 2222, label: 'DirectAdmin' },
  ];

  for (const { port, label } of ports) {
    const spinner = ora({ text: `Checking ${label} on port ${port}...`, spinner: 'dots12', color: 'cyan' }).start();

    try {
      const info = await checkCert(host, port);

      let statusColor = theme.success;
      let statusText = 'Valid';
      if (info.daysRemaining <= 0) {
        statusColor = theme.error;
        statusText = 'EXPIRED';
      } else if (info.daysRemaining <= 14) {
        statusColor = theme.warning;
        statusText = `Expires in ${info.daysRemaining} days`;
      } else if (info.daysRemaining <= 30) {
        statusColor = theme.warning;
        statusText = `Expires in ${info.daysRemaining} days`;
      }

      spinner.succeed(statusColor(`${label} — ${statusText}`));

      const lines = [
        theme.keyValue('Subject', info.subject, 0),
        theme.keyValue('Issuer', info.issuer, 0),
        theme.keyValue('Valid From', info.validFrom.toLocaleDateString(), 0),
        theme.keyValue('Valid Until', info.validTo.toLocaleDateString(), 0),
        theme.keyValue('Days Left', statusColor(info.daysRemaining.toString()), 0),
        theme.keyValue('Protocol', info.protocol, 0),
        theme.keyValue('Cipher', info.cipher, 0),
      ];

      if (info.altNames.length > 0 && info.altNames.length <= 5) {
        lines.push(theme.keyValue('Alt Names', info.altNames.join(', '), 0));
      } else if (info.altNames.length > 5) {
        lines.push(theme.keyValue('Alt Names', `${info.altNames.length} entries`, 0));
      }

      console.log(theme.box(lines.join('\n'), `Port ${port}`));
      console.log('');
    } catch (err: any) {
      spinner.fail(chalk.red(`${label} — ${err.message}`));
    }
  }

  // Summary
  console.log(theme.muted("  TIP: MXroute manages SSL certificates automatically via Let's Encrypt."));
  console.log(theme.muted('  If a certificate is expired, it usually renews within 24 hours.\n'));
}
