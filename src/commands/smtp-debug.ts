import chalk from 'chalk';
import ora from 'ora';
import * as tls from 'tls';
import * as net from 'net';
import { theme } from '../utils/theme';
import { getSendingAccount } from '../utils/sending-account';

function smtpSession(host: string, port: number, username: string, password: string): Promise<string[]> {
  return new Promise((resolve, _reject) => {
    const log: string[] = [];
    let buffer = '';
    let step = 0;

    function addLog(direction: 'S' | 'C', line: string) {
      const prefix = direction === 'S' ? chalk.green('S: ') : chalk.cyan('C: ');
      log.push(`${prefix}${line}`);
    }

    function processResponse(data: string) {
      buffer += data;
      const lines = buffer.split('\r\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line) continue;
        addLog('S', line);

        // Check for multi-line responses (e.g., 250-PIPELINING)
        if (line.match(/^\d{3}-/)) continue;

        const code = parseInt(line.substring(0, 3), 10);

        if (step === 0 && code === 220) {
          // Greeting received, send EHLO
          step = 1;
          const cmd = `EHLO mxroute-cli.local`;
          addLog('C', cmd);
          socket.write(cmd + '\r\n');
        } else if (step === 1 && code === 250) {
          // EHLO response complete, try AUTH LOGIN
          step = 2;
          const cmd = 'AUTH LOGIN';
          addLog('C', cmd);
          socket.write(cmd + '\r\n');
        } else if (step === 2 && code === 334) {
          // Send username (base64)
          step = 3;
          const encoded = Buffer.from(username).toString('base64');
          addLog('C', `${encoded} (username)`);
          socket.write(encoded + '\r\n');
        } else if (step === 3 && code === 334) {
          // Send password (base64)
          step = 4;
          const encoded = Buffer.from(password).toString('base64');
          addLog('C', `${'*'.repeat(encoded.length)} (password)`);
          socket.write(encoded + '\r\n');
        } else if (step === 4) {
          // Auth result
          step = 5;
          const cmd = 'QUIT';
          addLog('C', cmd);
          socket.write(cmd + '\r\n');
        } else if (step === 5) {
          socket.destroy();
          resolve(log);
          return;
        } else if (code >= 400) {
          // Error response
          socket.destroy();
          resolve(log);
          return;
        }
      }
    }

    let socket: tls.TLSSocket | net.Socket;

    if (port === 465) {
      // Implicit TLS
      socket = tls.connect({ host, port, servername: host }, () => {
        addLog('C', `(TLS connected to ${host}:${port})`);
      });
    } else {
      // STARTTLS — connect plain first
      socket = net.connect({ host, port }, () => {
        addLog('C', `(Connected to ${host}:${port})`);
      });
    }

    socket.setEncoding('utf-8');
    socket.setTimeout(15000);

    socket.on('data', (data: string) => processResponse(data));
    socket.on('timeout', () => {
      addLog('C', '(Connection timed out)');
      socket.destroy();
      resolve(log);
    });
    socket.on('error', (err) => {
      addLog('C', `(Error: ${err.message})`);
      resolve(log);
    });
    socket.on('close', () => {
      if (step < 5) resolve(log);
    });
  });
}

export async function smtpDebugCommand(): Promise<void> {
  const account = await getSendingAccount();

  const host = account.server;

  console.log(theme.heading('SMTP Debug Session'));
  console.log(theme.keyValue('Server', host));
  console.log(theme.keyValue('Port', '465 (SSL)'));
  console.log(theme.keyValue('Username', account.email));
  console.log('');

  const spinner = ora({ text: 'Running SMTP session...', spinner: 'dots12', color: 'cyan' }).start();
  const startTime = Date.now();

  try {
    const log = await smtpSession(host, 465, account.email, account.password);
    const duration = Date.now() - startTime;

    spinner.stop();

    console.log(theme.subheading('Session Log:'));
    console.log('');
    for (const line of log) {
      console.log(`    ${line}`);
    }
    console.log('');

    // Check if auth succeeded
    const authLine = log.find((l) => l.includes('235') || l.includes('Authentication'));
    const authFailed = log.find((l) => l.includes('535') || l.includes('authentication failed'));

    const summaryLines = [
      theme.keyValue('Duration', `${duration}ms`, 0),
      theme.keyValue(
        'Auth',
        authLine ? chalk.green('Success') : authFailed ? chalk.red('Failed') : chalk.yellow('Unknown'),
        0,
      ),
    ];

    console.log(theme.box(summaryLines.join('\n'), 'Session Summary'));
    console.log('');

    if (authFailed) {
      console.log(theme.error(`  ${theme.statusIcon('fail')} Authentication failed. Check your SMTP credentials.`));
      console.log(theme.muted(`  Run ${theme.bold('mxroute config smtp')} to reconfigure.\n`));
    }
  } catch (err: any) {
    spinner.fail(chalk.red(`SMTP debug failed: ${err.message}`));
  }
}
