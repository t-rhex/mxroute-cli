import chalk from 'chalk';
import ora from 'ora';
import * as dns from 'dns';
import { theme } from '../utils/theme';
import { listForwarders, getForwarderDestination } from '../utils/directadmin';
import { getCreds, pickDomain } from '../utils/shared';

function resolveMx(domain: string): Promise<dns.MxRecord[]> {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses || []);
    });
  });
}

function resolveA(domain: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    dns.resolve4(domain, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses || []);
    });
  });
}

interface ValidationResult {
  forwarder: string;
  destination: string;
  destDomain: string;
  hasMx: boolean;
  hasA: boolean;
  status: 'valid' | 'warning' | 'invalid';
  message: string;
}

export async function forwardersValidate(domain?: string): Promise<void> {
  const creds = getCreds();
  const targetDomain = await pickDomain(creds, domain);

  console.log(theme.heading(`Validate Forwarders: ${targetDomain}`));

  const spinner = ora({ text: 'Fetching forwarders...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const forwarders = await listForwarders(creds, targetDomain);

    if (forwarders.length === 0) {
      spinner.stop();
      console.log(theme.muted('  No forwarders found on this domain.\n'));
      return;
    }

    spinner.text = `Validating ${forwarders.length} forwarder${forwarders.length === 1 ? '' : 's'}...`;

    const results: ValidationResult[] = [];

    for (const fwd of forwarders) {
      let dest: string;
      try {
        dest = await getForwarderDestination(creds, targetDomain, fwd);
      } catch {
        results.push({
          forwarder: `${fwd}@${targetDomain}`,
          destination: 'unknown',
          destDomain: '',
          hasMx: false,
          hasA: false,
          status: 'warning',
          message: 'Could not fetch destination',
        });
        continue;
      }

      // Destination may be comma-separated
      const destinations = dest
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      for (const destEmail of destinations) {
        const atIndex = destEmail.lastIndexOf('@');
        if (atIndex === -1) {
          results.push({
            forwarder: `${fwd}@${targetDomain}`,
            destination: destEmail,
            destDomain: '',
            hasMx: false,
            hasA: false,
            status: 'invalid',
            message: 'Invalid email format',
          });
          continue;
        }

        const destDomain = destEmail.substring(atIndex + 1);
        let hasMx = false;
        let hasA = false;

        try {
          const mxRecords = await resolveMx(destDomain);
          hasMx = mxRecords.length > 0;
        } catch {
          hasMx = false;
        }

        if (!hasMx) {
          try {
            const aRecords = await resolveA(destDomain);
            hasA = aRecords.length > 0;
          } catch {
            hasA = false;
          }
        }

        let status: 'valid' | 'warning' | 'invalid' = 'valid';
        let message = 'MX records found — destination reachable';

        if (!hasMx && hasA) {
          status = 'warning';
          message = 'No MX records, but A record exists — may work';
        } else if (!hasMx && !hasA) {
          status = 'invalid';
          message = 'No MX or A records — destination unreachable';
        }

        results.push({
          forwarder: `${fwd}@${targetDomain}`,
          destination: destEmail,
          destDomain,
          hasMx,
          hasA,
          status,
          message,
        });
      }
    }

    spinner.stop();

    // Display results
    const valid = results.filter((r) => r.status === 'valid');
    const warnings = results.filter((r) => r.status === 'warning');
    const invalid = results.filter((r) => r.status === 'invalid');

    for (const r of results) {
      const icon =
        r.status === 'valid'
          ? theme.statusIcon('pass')
          : r.status === 'warning'
            ? theme.statusIcon('warn')
            : theme.statusIcon('fail');
      console.log(`  ${icon} ${theme.bold(r.forwarder)} ${theme.muted('\u2192')} ${r.destination}`);
      console.log(theme.muted(`      ${r.message}`));
    }

    console.log('');

    // Summary
    const summaryLines = [
      theme.keyValue('Total', results.length.toString(), 0),
      theme.keyValue('Valid', theme.success(valid.length.toString()), 0),
      theme.keyValue('Warnings', warnings.length > 0 ? theme.warning(warnings.length.toString()) : '0', 0),
      theme.keyValue('Invalid', invalid.length > 0 ? theme.error(invalid.length.toString()) : '0', 0),
    ];

    console.log(theme.box(summaryLines.join('\n'), 'Validation Summary'));
    console.log('');

    if (invalid.length > 0) {
      console.log(
        theme.warning(
          `  ${theme.statusIcon('warn')} ${invalid.length} forwarder${invalid.length === 1 ? '' : 's'} point to unreachable destinations.`,
        ),
      );
      console.log(theme.muted('  Consider removing or updating them with: mxroute forwarders delete\n'));
    }
  } catch (err: any) {
    spinner.fail(chalk.red('Validation failed'));
    console.log(theme.error(`  ${err.message}\n`));
  }
}
