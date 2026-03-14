import * as net from 'net';
import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { getCreds } from '../utils/shared';
import { listDomains } from '../utils/directadmin';
import { checkSpfRecord, checkDkimRecord, checkMxRecords } from '../utils/dns';
import { sendEmail } from '../utils/api';

interface PortCheckResult {
  host: string;
  port: number;
  service: string;
  open: boolean;
  responseTime: number;
}

async function checkPort(host: string, port: number, service: string, timeout = 5000): Promise<PortCheckResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on('connect', () => {
      const responseTime = Date.now() - start;
      socket.destroy();
      resolve({ host, port, service, open: true, responseTime });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ host, port, service, open: false, responseTime: timeout });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ host, port, service, open: false, responseTime: Date.now() - start });
    });

    socket.connect(port, host);
  });
}

export async function monitorCommand(options: { quiet?: boolean; alert?: boolean } = {}): Promise<void> {
  const config = getConfig();
  const server = config.server;

  if (!server) {
    if (!options.quiet) {
      console.log(
        theme.error(`\n  ${theme.statusIcon('fail')} Not configured. Run ${theme.bold('mxroute config setup')}\n`),
      );
    }
    process.exit(1);
  }

  const hostname = `${server}.mxrouting.net`;
  const issues: string[] = [];

  if (!options.quiet) {
    console.log(theme.heading('Monitor Check'));
    console.log(theme.muted(`  Server: ${hostname}\n`));
  }

  // 1. Port checks
  const ports = [
    { port: 993, service: 'IMAP (SSL)' },
    { port: 465, service: 'SMTP (SSL)' },
    { port: 587, service: 'SMTP (STARTTLS)' },
    { port: 143, service: 'IMAP (STARTTLS)' },
  ];

  if (!options.quiet) {
    console.log(theme.subheading('Port Connectivity'));
  }

  for (const { port, service } of ports) {
    const result = await checkPort(hostname, port, service);
    if (!options.quiet) {
      const icon = result.open ? theme.statusIcon('pass') : theme.statusIcon('fail');
      const status = result.open ? theme.success(`${result.responseTime}ms`) : theme.error('unreachable');
      console.log(`    ${icon} ${theme.bold(service.padEnd(20))} ${status}`);
    }
    if (!result.open) {
      issues.push(`Port ${port} (${service}) is unreachable on ${hostname}`);
    }
  }

  // 2. DNS checks for all domains
  let domains: string[] = [];
  if (config.daUsername && config.daLoginKey) {
    try {
      const creds = getCreds();
      domains = await listDomains(creds);
    } catch {
      // skip domain checks
    }
  } else if (config.domain) {
    domains = [config.domain];
  }

  if (domains.length > 0 && !options.quiet) {
    console.log('');
    console.log(theme.subheading('DNS Status'));
  }

  for (const domain of domains) {
    const mx = await checkMxRecords(domain, server);
    const spf = await checkSpfRecord(domain);
    const dkim = await checkDkimRecord(domain);

    if (!options.quiet) {
      const mxIcon = mx.status === 'pass' ? theme.statusIcon('pass') : theme.statusIcon('fail');
      const spfIcon = spf.status === 'pass' ? theme.statusIcon('pass') : theme.statusIcon('fail');
      const dkimIcon = dkim.status === 'pass' ? theme.statusIcon('pass') : theme.statusIcon('fail');
      console.log(`    ${mxIcon} ${domain} MX  ${spfIcon} SPF  ${dkimIcon} DKIM`);
    }

    if (mx.status === 'fail') issues.push(`${domain}: MX records not configured correctly`);
    if (spf.status === 'fail') issues.push(`${domain}: SPF record missing or incorrect`);
    if (dkim.status === 'fail') issues.push(`${domain}: DKIM record missing`);
  }

  // 3. Summary
  if (!options.quiet) {
    console.log('');
    console.log(theme.separator());
    console.log('');
  }

  if (issues.length === 0) {
    if (!options.quiet) {
      console.log(theme.success(`  ${theme.statusIcon('pass')} All checks passed — ${hostname} is healthy\n`));
    }
    process.exit(0);
  } else {
    if (!options.quiet) {
      console.log(
        theme.error(
          `  ${theme.statusIcon('fail')} ${issues.length} issue${issues.length !== 1 ? 's' : ''} detected:\n`,
        ),
      );
      for (const issue of issues) {
        console.log(theme.error(`    - ${issue}`));
      }
      console.log('');
    }

    // Send alert email if configured and --alert flag
    if (options.alert && config.username && config.password && config.server) {
      if (!options.quiet) {
        const alertSpinner = ora({ text: 'Sending alert email...', spinner: 'dots12', color: 'red' }).start();
        try {
          await sendEmail({
            server: `${config.server}.mxrouting.net`,
            username: config.username,
            password: config.password,
            from: config.username,
            to: config.username,
            subject: `[MXroute Alert] ${issues.length} issue${issues.length !== 1 ? 's' : ''} detected`,
            body: `<div style="font-family: system-ui, sans-serif; padding: 20px;">
              <h2 style="color: #FF5252;">MXroute Monitor Alert</h2>
              <p>Issues detected at ${new Date().toISOString()}:</p>
              <ul>${issues.map((i) => `<li>${i}</li>`).join('')}</ul>
              <p style="color: #999; margin-top: 20px;">Server: ${hostname}</p>
            </div>`,
          });
          alertSpinner.succeed('Alert email sent');
        } catch (err: any) {
          alertSpinner.fail(`Could not send alert: ${err.message}`);
        }
      }
    }

    process.exit(1);
  }
}
