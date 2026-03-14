import * as fs from 'fs';
import ora from 'ora';
import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { getCreds } from '../utils/shared';
import {
  listDomains,
  listEmailAccounts,
  listForwarders,
  listAutoresponders,
  getCatchAll,
  getSpamConfig,
  getQuotaUsage,
  getUserConfig,
} from '../utils/directadmin';
import { runFullDnsCheck } from '../utils/dns';
import { checkAllBlacklists, resolveServerIp } from '../utils/blacklist';

export async function reportCommand(): Promise<void> {
  const config = getConfig();
  const creds = getCreds();

  console.log(theme.heading('Infrastructure Report'));

  const spinner = ora({ text: 'Generating report...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    // Gather all data
    const domains = await listDomains(creds);
    const [usage, userConfig] = await Promise.all([getQuotaUsage(creds), getUserConfig(creds)]);

    const domainData: any[] = [];
    for (const domain of domains) {
      const [accounts, forwarders, autoresponders, catchAll, spamConfig, dnsResults] = await Promise.all([
        listEmailAccounts(creds, domain).catch(() => []),
        listForwarders(creds, domain).catch(() => []),
        listAutoresponders(creds, domain).catch(() => []),
        getCatchAll(creds, domain).catch(() => ''),
        getSpamConfig(creds, domain).catch(() => ({})),
        runFullDnsCheck(domain, config.server).catch(() => []),
      ]);

      domainData.push({ domain, accounts, forwarders, autoresponders, catchAll, spamConfig, dnsResults });
    }

    // Blacklist check
    let blacklistResults: any[] = [];
    try {
      const ip = await resolveServerIp(`${config.server}.mxrouting.net`);
      blacklistResults = await checkAllBlacklists(ip);
    } catch {
      /* skip */
    }

    spinner.succeed('Data collected');

    // Generate HTML
    const html = generateReportHtml({
      server: config.server,
      daUsername: config.daUsername,
      domains: domainData,
      usage,
      userConfig,
      blacklistResults,
      generatedAt: new Date().toISOString(),
    });

    const filename = `mxroute-report-${new Date().toISOString().split('T')[0]}.html`;

    const { outputFile } = await inquirer.prompt([
      {
        type: 'input',
        name: 'outputFile',
        message: theme.secondary('Output file:'),
        default: filename,
      },
    ]);

    fs.writeFileSync(outputFile, html);
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Report saved to ${outputFile}`));
    console.log(theme.muted(`  Open in a browser to view.\n`));
  } catch (err: any) {
    spinner.fail('Report generation failed');
    console.log(theme.error(`  ${err.message}\n`));
  }
}

function generateReportHtml(data: any): string {
  const { server, domains, usage, blacklistResults, generatedAt } = data;

  const totalAccounts = domains.reduce((s: number, d: any) => s + d.accounts.length, 0);
  const totalForwarders = domains.reduce((s: number, d: any) => s + d.forwarders.length, 0);
  const blacklisted = blacklistResults.filter((r: any) => r.listed).length;

  let domainSections = '';
  for (const d of domains) {
    const dnsChecks = d.dnsResults || [];
    const dnsPassed = dnsChecks.filter((r: any) => r.status === 'pass').length;
    const dnsTotal = dnsChecks.length;
    const dnsColor = dnsPassed === dnsTotal ? '#00E676' : dnsPassed >= dnsTotal - 2 ? '#FFD600' : '#FF5252';

    const catchAllLabel =
      d.catchAll === ':fail:' ? 'Reject' : d.catchAll === ':blackhole:' ? 'Disabled' : d.catchAll || 'Not set';

    domainSections += `
    <div class="card">
      <h3>${d.domain} <span class="dns-score" style="color:${dnsColor}">${dnsPassed}/${dnsTotal} DNS</span></h3>
      <div class="grid">
        <div class="stat"><span class="num">${d.accounts.length}</span><span class="label">Accounts</span></div>
        <div class="stat"><span class="num">${d.forwarders.length}</span><span class="label">Forwarders</span></div>
        <div class="stat"><span class="num">${d.autoresponders.length}</span><span class="label">Autoresponders</span></div>
      </div>
      <div class="detail"><strong>Catch-all:</strong> ${catchAllLabel}</div>
      ${d.accounts.length > 0 ? `<div class="detail"><strong>Accounts:</strong> ${d.accounts.map((a: string) => `${a}@${d.domain}`).join(', ')}</div>` : ''}
      <div class="dns-list">
        ${dnsChecks.map((r: any) => `<span class="dns-item ${r.status}">${r.type}: ${r.status}</span>`).join(' ')}
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MXroute Infrastructure Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a1a; color: #e0e0e0; padding: 2rem; }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { color: #00D9FF; font-size: 2rem; margin-bottom: 0.25rem; }
  h2 { color: #6C63FF; font-size: 1.3rem; margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #1a1a2e; }
  h3 { color: #fff; font-size: 1.1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; }
  .subtitle { color: #7C8DB0; margin-bottom: 2rem; }
  .overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .overview-card { background: #1a1a2e; border: 1px solid #222; border-radius: 8px; padding: 1.25rem; text-align: center; }
  .overview-card .num { font-size: 2rem; font-weight: bold; color: #00D9FF; display: block; }
  .overview-card .label { color: #7C8DB0; font-size: 0.85rem; }
  .card { background: #1a1a2e; border: 1px solid #222; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 0.75rem 0; }
  .stat { text-align: center; }
  .stat .num { font-size: 1.5rem; font-weight: bold; color: #00D9FF; display: block; }
  .stat .label { color: #7C8DB0; font-size: 0.8rem; }
  .detail { color: #aaa; font-size: 0.9rem; margin: 0.4rem 0; }
  .dns-score { font-size: 0.85rem; font-weight: normal; }
  .dns-list { margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .dns-item { font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; }
  .dns-item.pass { background: #00E67622; color: #00E676; }
  .dns-item.fail { background: #FF525222; color: #FF5252; }
  .dns-item.warn { background: #FFD60022; color: #FFD600; }
  .dns-item.info { background: #448AFF22; color: #448AFF; }
  .bl-clean { color: #00E676; }
  .bl-listed { color: #FF5252; }
  .footer { color: #555; font-size: 0.8rem; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #1a1a2e; }
  @media (prefers-color-scheme: light) {
    body { background: #f5f5f5; color: #333; }
    .card, .overview-card { background: #fff; border-color: #ddd; }
    .detail { color: #666; }
  }
</style>
</head>
<body>
<div class="container">
  <h1>MXroute Infrastructure Report</h1>
  <p class="subtitle">Server: ${server}.mxrouting.net — Generated: ${new Date(generatedAt).toLocaleString()}</p>

  <div class="overview">
    <div class="overview-card"><span class="num">${domains.length}</span><span class="label">Domains</span></div>
    <div class="overview-card"><span class="num">${totalAccounts}</span><span class="label">Email Accounts</span></div>
    <div class="overview-card"><span class="num">${totalForwarders}</span><span class="label">Forwarders</span></div>
    <div class="overview-card"><span class="num">${usage.quota || usage.disk || '?'} MB</span><span class="label">Disk Used</span></div>
    <div class="overview-card"><span class="num ${blacklisted > 0 ? 'bl-listed' : 'bl-clean'}">${blacklisted > 0 ? blacklisted + ' listed' : 'Clean'}</span><span class="label">Blacklists (${blacklistResults.length})</span></div>
  </div>

  <h2>Domains</h2>
  ${domainSections}

  ${
    blacklistResults.length > 0
      ? `
  <h2>IP Reputation</h2>
  <div class="card">
    ${blacklistResults.map((r: any) => `<span class="dns-item ${r.listed ? 'fail' : 'pass'}">${r.list}: ${r.listed ? 'LISTED' : 'Clean'}</span>`).join(' ')}
  </div>
  `
      : ''
  }

  <p class="footer">Generated by mxroute-cli — https://github.com/t-rhex/mxroute-cli</p>
</div>
</body>
</html>`;
}
