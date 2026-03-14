# mxroute-cli

A comprehensive CLI and MCP server for managing [MXroute](https://mxroute.com) email hosting. Full account management, automated DNS configuration, email sending, spam control, security auditing, monitoring, and more -- all from your terminal.

```
   __  ____  __                _
  |  \/  \ \/ /_ __ ___  _   _| |_ ___
  | |\/| |\  /| '__/ _ \| | | | __/ _ \
  | |  | |/  \| | | (_) | |_| | ||  __/
  |_|  |_/_/\_\_|  \___/ \__,_|\__\___|

  Email Hosting Management CLI
```

[![npm version](https://img.shields.io/npm/v/mxroute-cli)](https://www.npmjs.com/package/mxroute-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/t-rhex/mxroute-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/t-rhex/mxroute-cli/actions)

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Credentials](#credentials)
- [Command Reference](#command-reference)
  - [Core](#core)
  - [Email Management](#email-management)
  - [DNS Management](#dns-management)
  - [Email Sending](#email-sending)
  - [Spam and Security](#spam-and-security)
  - [Monitoring and Operations](#monitoring-and-operations)
  - [Data Management](#data-management)
  - [Troubleshooting](#troubleshooting)
  - [Connection Info](#connection-info)
- [Configuration](#configuration)
- [MCP Server](#mcp-server)
- [Automated DNS Setup](#automated-dns-setup)
- [Monitoring and Cron](#monitoring-and-cron)
- [Shell Completions](#shell-completions)
- [Development](#development)
- [Requirements](#requirements)
- [License](#license)

---

## Features

- **41 command groups, 100+ subcommands** -- manage every aspect of MXroute from the terminal
- **Automated DNS setup** -- configure MX, SPF, DKIM, and DMARC records via Cloudflare, Porkbun, DigitalOcean, or Namecheap APIs
- **MCP server** -- 36 tools exposed via the Model Context Protocol for AI-assisted email management
- **Security auditing** -- score your domains against DNS, SPF lookup count, catch-all, and forwarding loop checks
- **Blacklist monitoring** -- check your server IP against 10 DNS blacklists
- **Health monitoring** -- cron-friendly health checks with alert support
- **Bulk operations** -- create accounts and forwarders from CSV files
- **Export/import** -- back up and restore your entire configuration as JSON
- **Email webhook** -- local HTTP server that relays email through MXroute SMTP
- **Multi-profile support** -- manage multiple MXroute accounts from one CLI
- **Secure config** -- credentials stored with `0600` permissions in `~/.config/mxroute-cli/`

---

## Installation

```bash
npm install -g mxroute-cli
```

This installs two binaries:
- `mxroute` -- the CLI
- `mxroute-mcp` -- the MCP server

---

## Quick Start

```bash
# 1. Run the interactive setup wizard
mxroute setup

# Or configure step by step:
mxroute config setup          # SMTP credentials (for sending email)
mxroute auth login            # DirectAdmin API auth (for account management)

# 2. Check your DNS records
mxroute dns check

# 3. View your account dashboard
mxroute status
```

**Example -- status dashboard:**
```
  ┌─ Account Status ────────────────────────────────────────┐
  │  Profile          default                                │
  │  Server           fusion.mxrouting.net                   │
  │  Account          user@example.com                       │
  │                                                          │
  │  DNS Health                                              │
  │  MX  ✔  SPF  ✔  DKIM  ✔  DMARC  ✔  CNAME  ●           │
  │                                                          │
  │  SMTP API         ✔ Connected                            │
  └──────────────────────────────────────────────────────────┘
```

---

## Credentials

The CLI uses two types of credentials:

| Credential | Purpose | Where to find |
|---|---|---|
| **Server hostname** | Identifies your MXroute server | Control Panel -> DNS section (e.g., `tuesday`, `fusion`) |
| **Email + password** | SMTP API (sending email) | Your email account credentials |
| **DirectAdmin username** | API authentication | Your DirectAdmin login username |
| **Login Key** | API authentication (recommended) | Control Panel -> Login Keys -> Create new key |

> **Why Login Keys?** They are more secure than passwords -- you can restrict permissions, set expiry dates, and revoke them without changing your password.

**Which commands need which credentials:**

| Credential | Required for |
|---|---|
| **SMTP credentials** | `send`, `test`, `webhook`, `monitor` |
| **DirectAdmin Login Key** | `domains`, `accounts`, `forwarders`, `autoresponder`, `catchall`, `spam`, `dnsrecords`, `filters`, `lists`, `aliases`, `quota`, `audit`, `doctor`, `export` |
| **None** (server name only) | `dns check`, `dns records`, `dns generate`, `info`, `troubleshoot`, `ip` |

---

## Command Reference

### Core

| Command | Description |
|---|---|
| `mxroute setup` | Interactive setup wizard -- configures CLI, MCP server, and skills |
| `mxroute status` | Account dashboard with auth status, DNS health, and connectivity |
| `mxroute whoami` | Quick account overview |
| `mxroute open [target]` | Open MXroute panels in your browser |

#### config -- Configuration Management

```bash
mxroute config setup           # Interactive configuration wizard
mxroute config smtp            # Configure SMTP credentials
mxroute config remove-smtp     # Remove SMTP credentials
mxroute config show            # Show current config (passwords masked)
mxroute config profiles        # List all saved profiles
mxroute config switch [name]   # Switch between profiles
mxroute config delete [name]   # Delete a profile
```

#### auth -- Authentication

```bash
mxroute auth login             # Interactive login with Login Key
mxroute auth status            # Verify stored credentials are valid
mxroute auth logout            # Remove stored credentials
```

**Example:**
```bash
$ mxroute auth login
? Server hostname: fusion
? DirectAdmin username: myuser
? Login Key: ••••••••
✔ Authentication successful!
```

---

### Email Management

#### domains -- Domain Management

```bash
mxroute domains list                   # List all domains with alias counts
mxroute domains info [domain]          # Show details for a domain
```

#### accounts -- Email Accounts

```bash
mxroute accounts list [domain]         # List email accounts
mxroute accounts create [domain]       # Create an email account (interactive)
mxroute accounts delete [domain]       # Delete an email account
mxroute accounts passwd [domain]       # Change account password
```

**Example:**
```bash
$ mxroute accounts create example.com
? Username (before @example.com): info
? Password: ••••••••
? Confirm password: ••••••••
? Quota in MB (0 = unlimited): 0
? Create info@example.com? Yes
✔ Created info@example.com
```

#### forwarders / fwd -- Email Forwarders

```bash
mxroute forwarders list [domain]       # List all forwarders
mxroute forwarders create [domain]     # Create a forwarder (interactive)
mxroute forwarders delete [domain]     # Delete a forwarder
```

#### autoresponder / vacation -- Autoresponders

```bash
mxroute autoresponder list [domain]    # List all autoresponders
mxroute autoresponder create [domain]  # Create autoresponder (opens editor)
mxroute autoresponder edit [domain]    # Edit existing autoresponder
mxroute autoresponder delete [domain]  # Delete an autoresponder
```

#### catchall -- Catch-All / Default Address

```bash
mxroute catchall get [domain]          # Show current catch-all setting
mxroute catchall set [domain]          # Configure catch-all (interactive)
```

Options: forward to existing account, forward to custom email, reject (`:fail:`), or disable (`:blackhole:`).

#### filters -- Email Filters

```bash
mxroute filters list [domain]          # List filters for an account
mxroute filters create [domain]        # Create a filter (interactive)
mxroute filters delete [domain]        # Delete a filter
```

Supports matching on from, to, subject, or body with actions to discard, forward, or move to a folder.

#### lists / mailinglist -- Mailing Lists

```bash
mxroute lists list [domain]            # List all mailing lists
mxroute lists create [domain]          # Create a mailing list
mxroute lists delete [domain]          # Delete a mailing list
mxroute lists members [domain]         # Show members of a list
mxroute lists add-member [domain]      # Add a member
mxroute lists remove-member [domain]   # Remove a member
```

#### aliases -- Domain Aliases / Pointers

```bash
mxroute aliases list [domain]          # List domain aliases
mxroute aliases add [domain]           # Add a domain alias
mxroute aliases remove [domain]        # Remove a domain alias
```

> **How aliases work:** If `primary.com` has `user@primary.com`, adding `alias.com` as a pointer means `user@alias.com` also works -- all accounts are shared.

#### quota -- Quota and Usage

```bash
mxroute quota show                     # Account-wide usage overview
mxroute quota set [domain]             # Set quota for a specific account
```

**Example output:**
```
  ┌─ Resource Usage ─────────────────────────────────────────────┐
  │  Disk Usage         3.19MB / 100.0GB  [--------------------] 0%  │
  │  Bandwidth          1.26MB / unlimited                           │
  │  Email Accounts     12 / unlimited                               │
  │  Domains            3 / unlimited                                │
  │  Forwarders         1 / unlimited                                │
  └──────────────────────────────────────────────────────────────────┘
```

---

### DNS Management

#### dns -- DNS Health and Records

```bash
mxroute dns check [domain]            # Health check via DNS lookup
mxroute dns records [domain]          # Show required DNS records for your server
mxroute dns generate [domain]         # Generate zone file for your DNS provider
mxroute dns setup [domain]            # Auto-configure via registrar API
mxroute dns watch [domain]            # Real-time DNS propagation monitoring
```

**What `dns check` verifies:**
- **MX** -- primary and relay records pointing to your MXroute server
- **SPF** -- `v=spf1 include:mxroute.com -all` present with hard fail
- **DKIM** -- `x._domainkey` TXT record with valid DKIM1 key
- **DMARC** -- `_dmarc` TXT record with quarantine or reject policy
- **CNAME** -- custom hostnames for mail/webmail (optional)

**`dns generate` supports:** Cloudflare, Namecheap, Route53/AWS, and generic providers.

#### dnsrecords / dnsapi -- DNS Record Management via API

Manage DNS records directly on your MXroute server. Requires authentication.

```bash
mxroute dnsrecords list [domain]       # List all DNS records from server
mxroute dnsrecords add [domain]        # Add a record (A, AAAA, CNAME, MX, TXT, SRV)
mxroute dnsrecords delete [domain]     # Delete a DNS record
mxroute dnsrecords dkim [domain]       # Retrieve the full DKIM key
```

---

### Email Sending

#### send -- Send Email via SMTP

```bash
mxroute send                                                    # Interactive composer
mxroute send -t user@example.com -s "Subject" -b "Body"        # Send with flags
mxroute send -t user@example.com -s "Hi" --html -b "<h1>Hello</h1>"  # HTML email
mxroute send -f alias@example.com -t user@example.com -s "Hi" -b "Body"  # Custom from
mxroute send -t user@example.com -s "Report" --file report.pdf  # With attachment
```

| Flag | Description |
|---|---|
| `-t, --to <email>` | Recipient email address |
| `-s, --subject <text>` | Email subject line |
| `-b, --body <text>` | Email body content |
| `-f, --from <email>` | Sender address (defaults to configured account) |
| `--html` | Treat body as raw HTML |
| `--file <path>` | Attach a file |

#### test -- Test Email

```bash
mxroute test                           # Send a test email to yourself
```

#### webhook -- Email Webhook Server

Start a local HTTP server that accepts POST requests and relays them as email through MXroute SMTP.

```bash
mxroute webhook                        # Start on default port 3025
mxroute webhook --port 8080            # Custom port
```

**Endpoints:**
- `POST /send` -- send an email (`{ "to": "...", "subject": "...", "body": "..." }`)
- `GET /health` -- health check

---

### Spam and Security

#### spam -- SpamAssassin Configuration

```bash
mxroute spam status [domain]           # Show current SpamAssassin config
mxroute spam enable [domain]           # Enable with defaults (score 5, spam folder)
mxroute spam disable [domain]          # Disable SpamAssassin
mxroute spam config [domain]           # Interactive configuration wizard
```

Configuration options: required score (1-10), spam delivery action (move to folder, leave in inbox, delete), high score threshold, and high score action.

#### audit -- Security Audit

Run a comprehensive security audit across all domains with a scored report.

```bash
mxroute audit                          # Full security audit with score
```

Checks: DNS configuration, SPF lookup count, catch-all settings, forwarding loops, and more.

#### ip / blacklist -- IP Blacklist Check

```bash
mxroute ip                             # Check server IP against 10 DNS blacklists
```

---

### Monitoring and Operations

#### monitor -- Health Monitoring

Cron-friendly health check that tests DNS, port connectivity, and SMTP API across all domains.

```bash
mxroute monitor                        # Run health check with full output
mxroute monitor --quiet                # Exit code only (0 = healthy, 1 = issue)
mxroute monitor --alert                # Send email alert on failure
```

#### cron -- Cron Job Management

```bash
mxroute cron setup                     # Install monitoring cron job
mxroute cron remove                    # Remove monitoring cron job
```

#### doctor / healthcheck -- Comprehensive Diagnostics

```bash
mxroute doctor                         # Run checks across all domains
```

#### benchmark / bench -- Connection Speed Test

```bash
mxroute benchmark                      # Test IMAP/SMTP connection speed
```

---

### Data Management

#### export -- Export Configuration

```bash
mxroute export                         # Export all domains to JSON
mxroute export example.com            # Export specific domain
```

#### import -- Import Configuration

```bash
mxroute import backup.json            # Restore from export file
```

#### diff -- Compare Exports

```bash
mxroute diff before.json after.json   # Compare two export files
```

#### bulk -- Bulk Operations

```bash
mxroute bulk accounts accounts.csv    # Create accounts from CSV
mxroute bulk forwarders fwd.csv       # Create forwarders from CSV
```

---

### Troubleshooting

#### troubleshoot / diagnose -- Interactive Wizard

```bash
mxroute troubleshoot                   # Launch interactive wizard
```

Covers 10 issue categories:

1. Emails going to spam (Gmail)
2. Emails going to spam (Microsoft)
3. Cannot connect to server
4. Authentication failures
5. Emails not being delivered
6. DNS configuration issues
7. SSL certificate warnings
8. Common error messages (550 Auth Required, Sender Verify Failed, etc.)
9. Migration issues (imapsync guide)
10. Spam filter blocking legitimate mail

#### share -- Shareable Setup Page

```bash
mxroute share                          # Generate setup page for terminal
mxroute share user@example.com        # Generate for specific email
```

Produces an HTML page or terminal output with connection details to share with end users.

---

### Connection Info

Quick reference for email client settings and service details.

```bash
mxroute info connections               # IMAP/SMTP/POP3 ports table
mxroute info webmail                   # Webmail URLs (Crossbox, Roundcube)
mxroute info caldav                    # CalDAV/CardDAV setup
mxroute info api                       # SMTP API endpoint and limits
mxroute info limits                    # Service limits and policies
mxroute info panels                    # Management and Control Panel URLs
mxroute info all                       # Everything at once
mxroute info client <name>            # Client setup guide (ios, outlook, thunderbird, generic)
```

**Connection settings:**

| Protocol | Port | Encryption | Recommended |
|---|---|---|---|
| IMAP | 993 | SSL/TLS | Yes |
| IMAP | 143 | STARTTLS | Alternative |
| POP3 | 995 | SSL/TLS | Yes |
| POP3 | 110 | STARTTLS | Alternative |
| SMTP | 465 | SSL/TLS | Yes |
| SMTP | 587 | STARTTLS | Alternative |
| SMTP | 2525 | STARTTLS | If 587 blocked |

---

## Configuration

Configuration is stored at `~/.config/mxroute-cli/config.json` with file permissions `0600` (owner-only read/write).

### Multiple Profiles

Manage different MXroute accounts from one CLI:

```bash
# Create profiles
mxroute config setup                   # First run creates "default" profile
mxroute config setup                   # Enter "work" as profile name for second

# Switch between them
mxroute config switch                  # Interactive picker
mxroute config switch work             # Switch directly by name
mxroute config profiles                # List all profiles

# Delete a profile
mxroute config delete old              # Delete by name
```

---

## MCP Server

The `mxroute-mcp` binary exposes 36 tools via the [Model Context Protocol](https://modelcontextprotocol.io), allowing AI assistants to manage your MXroute account.

### Supported Clients

- Claude Code
- Claude Desktop
- Cursor
- Windsurf
- OpenCode
- Cline
- Continue.dev

### Quick Setup

The setup wizard auto-detects installed clients and configures them:

```bash
mxroute setup
```

### Manual Configuration

Add to your MCP client config:

```json
{
  "mcpServers": {
    "mxroute": {
      "command": "mxroute-mcp",
      "args": []
    }
  }
}
```

### Available MCP Tools

The MCP server provides tools for domains, email accounts, forwarders, autoresponders, catch-all, spam config, DNS records, DKIM keys, email filters, mailing lists, domain aliases, quota management, sending email, and DNS health checks.

---

## Automated DNS Setup

The `dns setup` command can automatically create all required MXroute DNS records at your registrar via API.

### Supported Registrars

| Registrar | API Support | Credentials Needed |
|---|---|---|
| **Cloudflare** | Full | API Token |
| **Porkbun** | Full | API Key + Secret Key |
| **DigitalOcean** | Full | API Token |
| **Namecheap** | Limited | API Key + Username |

### Usage

```bash
mxroute dns setup example.com
```

The wizard will:
1. Ask which registrar manages your DNS
2. Prompt for API credentials (saved for reuse)
3. Retrieve your DKIM key from the server
4. Create MX, SPF, DKIM, and DMARC records automatically
5. Verify the records propagated correctly

### Propagation Monitoring

After making DNS changes, watch propagation in real time:

```bash
mxroute dns watch example.com
```

---

## Monitoring and Cron

### Health Monitoring

The `monitor` command checks DNS records, port connectivity (IMAP/SMTP), and SMTP API health across all your domains.

```bash
# Full output
mxroute monitor

# Silent mode for cron (exit code only)
mxroute monitor --quiet

# Send email alert on failure
mxroute monitor --alert
```

### Cron Job Setup

Install automatic monitoring that runs on a schedule:

```bash
# Install the cron job
mxroute cron setup

# Remove the cron job
mxroute cron remove
```

---

## Shell Completions

Generate shell completion scripts for tab completion of commands and options.

```bash
mxroute completions bash               # Bash completions
mxroute completions zsh                # Zsh completions
mxroute completions fish               # Fish completions
```

**Install for your shell:**

```bash
# Bash
mxroute completions bash >> ~/.bashrc

# Zsh
mxroute completions zsh >> ~/.zshrc

# Fish
mxroute completions fish > ~/.config/fish/completions/mxroute.fish
```

---

## Development

### Setup

```bash
git clone https://github.com/t-rhex/mxroute-cli.git
cd mxroute-cli
npm install
npm run build
```

### Scripts

| Script | Description |
|---|---|
| `npm run build` | Compile TypeScript |
| `npm run dev` | Watch mode for development |
| `npm test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | Type check without emitting |
| `npm run ci` | Full CI pipeline (lint + typecheck + build + test) |

### Test Suite

78 tests across 15 test files covering API, audit, benchmark, blacklist, CLI, completions, config, diff, DirectAdmin, DNS, MCP, monitor, share, theme, and webhook functionality.

### Code Quality

- ESLint and Prettier enforce consistent style
- Husky pre-commit hooks run lint-staged on every commit
- GitHub Actions CI validates on Node.js 20 and 22
- Tag-based release workflow publishes to npm with provenance

### Project Structure

```
src/
  index.ts              # CLI entry point (Commander.js)
  mcp.ts                # MCP server entry point
  commands/             # 35 command modules
  utils/                # Shared utilities (API, config, DNS, DirectAdmin, registrars)
tests/                  # 15 test files (Vitest)
```

### Releasing

Releases are automated via GitHub Actions. Push a version tag to trigger npm publish:

```bash
npm run release              # Patch version bump
npm run release:minor        # Minor version bump
npm run release:major        # Major version bump
```

---

## MXroute Panels

| Panel | URL | Purpose |
|---|---|---|
| **Management Panel** | https://management.mxroute.com | Subscriptions, invoices, payment, support tickets |
| **Control Panel** | https://panel.mxroute.com | Email accounts, forwarders, domains, DNS, spam, webmail |
| **Whitelist Request** | https://whitelistrequest.mxrouting.net | Request IP/domain whitelist for spam filter |

---

## Requirements

- Node.js >= 20
- An [MXroute](https://mxroute.com) email hosting account

## License

MIT
