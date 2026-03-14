import * as net from 'net';
import ora from 'ora';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';

interface BenchResult {
  service: string;
  port: number;
  connected: boolean;
  connectTime: number;
  bannerTime: number;
  banner: string;
}

async function benchPort(host: string, port: number, service: string, timeout = 10000): Promise<BenchResult> {
  const startConnect = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    let banner = '';
    let connectTime = 0;

    socket.on('connect', () => {
      connectTime = Date.now() - startConnect;
    });

    socket.on('data', (data) => {
      banner = data.toString().trim().substring(0, 80);
      const bannerTime = Date.now() - startConnect;
      socket.destroy();
      resolve({ service, port, connected: true, connectTime, bannerTime, banner });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ service, port, connected: false, connectTime: timeout, bannerTime: timeout, banner: '' });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ service, port, connected: false, connectTime: Date.now() - startConnect, bannerTime: 0, banner: '' });
    });

    socket.connect(port, host);
  });
}

export async function benchmarkCommand(): Promise<void> {
  const config = getConfig();
  const server = config.server;

  if (!server) {
    console.log(
      theme.error(`\n  ${theme.statusIcon('fail')} Not configured. Run ${theme.bold('mxroute config setup')}\n`),
    );
    return;
  }

  const hostname = `${server}.mxrouting.net`;

  console.log(theme.heading(`Benchmark: ${hostname}`));
  console.log(theme.muted('  Testing connection speed to your MXroute server...\n'));

  const ports = [
    { port: 993, service: 'IMAP SSL' },
    { port: 465, service: 'SMTP SSL' },
    { port: 587, service: 'SMTP STARTTLS' },
    { port: 143, service: 'IMAP STARTTLS' },
    { port: 110, service: 'POP3 STARTTLS' },
    { port: 995, service: 'POP3 SSL' },
  ];

  const results: BenchResult[] = [];

  for (const { port, service } of ports) {
    const spinner = ora({ text: `Testing ${service} (${port})...`, spinner: 'dots12', color: 'cyan' }).start();
    const result = await benchPort(hostname, port, service);
    results.push(result);

    if (result.connected) {
      spinner.succeed(
        `${theme.bold(service.padEnd(16))} ` +
          `connect: ${colorLatency(result.connectTime)}  ` +
          `banner: ${colorLatency(result.bannerTime)}`,
      );
    } else {
      spinner.fail(`${theme.bold(service.padEnd(16))} unreachable`);
    }
  }

  // Summary
  const connected = results.filter((r) => r.connected);
  if (connected.length > 0) {
    const avgConnect = Math.round(connected.reduce((s, r) => s + r.connectTime, 0) / connected.length);
    const avgBanner = Math.round(connected.reduce((s, r) => s + r.bannerTime, 0) / connected.length);

    console.log('');
    console.log(theme.separator());
    console.log('');
    console.log(theme.keyValue('Avg Connect', `${avgConnect}ms`));
    console.log(theme.keyValue('Avg Response', `${avgBanner}ms`));
    console.log(theme.keyValue('Services Up', `${connected.length}/${results.length}`));

    let rating = 'Excellent';
    if (avgBanner > 500) rating = 'Slow';
    else if (avgBanner > 200) rating = 'Fair';
    else if (avgBanner > 100) rating = 'Good';

    console.log(theme.keyValue('Rating', rating));
    console.log('');
  }
}

function colorLatency(ms: number): string {
  const chalk = require('chalk');
  const text = `${ms}ms`;
  if (ms < 100) return chalk.hex('#00E676')(text);
  if (ms < 300) return chalk.hex('#FFD600')(text);
  return chalk.hex('#FF5252')(text);
}
