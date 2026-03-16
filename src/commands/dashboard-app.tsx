#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { getConfig } from '../utils/config';
import { listDomains, listEmailAccounts, listForwarders, getQuotaUsage } from '../utils/directadmin';
import { runFullDnsCheck, DnsCheckResult } from '../utils/dns';

// Types
interface DomainData {
  name: string;
  accounts: number;
  forwarders: number;
  dns: DnsCheckResult[];
}

// StatusBar component
function StatusBar({ server, profile, diskUsed }: { server: string; profile: string; diskUsed: string }) {
  return (
    <Box borderStyle="single" borderColor="blue" paddingX={1}>
      <Box width="50%">
        <Text color="cyan">Server: </Text>
        <Text bold>{server}.mxrouting.net</Text>
      </Box>
      <Box width="50%">
        <Text color="cyan">Profile: </Text>
        <Text bold>{profile}</Text>
        <Text> Disk: </Text>
        <Text bold>{diskUsed}</Text>
      </Box>
    </Box>
  );
}

// DomainTable component
function DomainTable({ domains }: { domains: DomainData[] }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color="blue">
          {pad('Domain', 22)}
        </Text>
        <Text bold color="blue">
          {pad('MX', 5)}
        </Text>
        <Text bold color="blue">
          {pad('SPF', 5)}
        </Text>
        <Text bold color="blue">
          {pad('DKIM', 6)}
        </Text>
        <Text bold color="blue">
          {pad('DMARC', 7)}
        </Text>
        <Text bold color="blue">
          {pad('Accts', 7)}
        </Text>
        <Text bold color="blue">
          Fwds
        </Text>
      </Box>
      {domains.map((d, i) => {
        const mx = d.dns.find((r) => r.type === 'MX');
        const spf = d.dns.find((r) => r.type === 'SPF');
        const dkim = d.dns.find((r) => r.type === 'DKIM');
        const dmarc = d.dns.find((r) => r.type === 'DMARC');
        return (
          <Box key={i}>
            <Text>{pad(d.name, 22)}</Text>
            <Text>{statusIcon(mx?.status)} </Text>
            <Text> {statusIcon(spf?.status)} </Text>
            <Text> {statusIcon(dkim?.status)}</Text>
            <Text> {statusIcon(dmarc?.status)} </Text>
            <Text> {pad(String(d.accounts), 7)}</Text>
            <Text>{d.forwarders}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

// BottomBar component
function BottomBar() {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="gray">[r]efresh [q]uit</Text>
    </Box>
  );
}

// Helper functions
function pad(str: string, width: number): string {
  return str.padEnd(width);
}

function statusIcon(status?: string): string {
  switch (status) {
    case 'pass':
      return '\u2714';
    case 'fail':
      return '\u2717';
    case 'warn':
      return '\u26A0';
    default:
      return '?';
  }
}

// Main App
function App() {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [server, setServer] = useState('');
  const [profile, setProfile] = useState('');
  const [diskUsed, setDiskUsed] = useState('');
  const [lastRefresh, setLastRefresh] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const config = getConfig();
      setServer(config.server);
      setProfile(config.activeProfile);

      if (!config.daUsername || !config.daLoginKey) {
        setError('Not authenticated. Run: mxroute config setup');
        setLoading(false);
        return;
      }

      const creds = {
        server: config.server,
        username: config.daUsername,
        loginKey: config.daLoginKey,
      };

      const [domainNames, usage] = await Promise.all([listDomains(creds), getQuotaUsage(creds).catch(() => ({}))]);

      setDiskUsed(`${usage.quota || usage.disk || '?'} MB`);

      const domainData: DomainData[] = [];
      for (const name of domainNames) {
        const [accounts, forwarders, dns] = await Promise.all([
          listEmailAccounts(creds, name).catch(() => []),
          listForwarders(creds, name).catch(() => []),
          runFullDnsCheck(name, config.server).catch(() => []),
        ]);
        domainData.push({
          name,
          accounts: accounts.length,
          forwarders: forwarders.length,
          dns,
        });
      }

      setDomains(domainData);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
    if (input === 'r') {
      fetchData();
    }
  });

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>
          Error: {error}
        </Text>
        <BottomBar />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box paddingX={1} paddingY={0}>
        <Text bold color="cyan">
          MXroute Dashboard
        </Text>
        {lastRefresh && <Text color="gray"> Last refresh: {lastRefresh}</Text>}
      </Box>
      <StatusBar server={server} profile={profile} diskUsed={diskUsed} />
      {loading ? (
        <Box padding={1}>
          <Text color="yellow">Loading...</Text>
        </Box>
      ) : (
        <DomainTable domains={domains} />
      )}
      <BottomBar />
    </Box>
  );
}

export async function dashboardCommand(): Promise<void> {
  const { waitUntilExit } = render(<App />);
  await waitUntilExit();
}
