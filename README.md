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
  - [Mail Client](#mail-client)
  - [Email Management](#email-management)
  - [DNS Management](#dns-management)
  - [Email Sending](#email-sending)
  - [Spam and Security](#spam-and-security)
  - [Monitoring and Operations](#monitoring-and-operations)
  - [Data Management](#data-management)
  - [Business Provisioning](#business-provisioning)
  - [Utilities](#utilities)
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

- **60+ command groups, 140+ subcommands** -- manage every aspect of MXroute from the terminal
- **Full mail client** -- read, compose, reply, forward, search, and manage emails via IMAP/SMTP directly from the CLI
- **Agentic email via MCP** -- 78+ tools exposed via the Model Context Protocol, including full mailbox access for AI agents
- **Business provisioning** -- manifest-based bulk setup, welcome emails, credential export, employee offboarding, quota policies
- **Multi-account support** -- all mail tools accept a `profile` parameter for operating on different accounts without switching
- **Automated DNS setup** -- configure MX, SPF, DKIM, and DMARC records via Cloudflare, Porkbun, DigitalOcean, or Namecheap APIs
- **Security auditing** -- score your domains against DNS, SPF lookup count, catch-all, and forwarding loop checks
- **Blacklist monitoring** -- check your server IP against 10 DNS blacklists
- **Health monitoring** -- cron-friendly health checks with alert support
- **Bulk operations** -- create accounts and forwarders from CSV, bulk mark/delete/move emails
- **Export/import** -- back up and restore your entire configuration as JSON
- **Email webhook** -- local HTTP server that relays email through MXroute SMTP
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

### Mail Client

Full IMAP/SMTP email client built into the CLI -- read, compose, reply, forward, search, and manage emails without leaving the terminal. Zero external dependencies (raw TLS sockets).

#### mail inbox -- View Inbox

```bash
mxroute mail inbox                     # List recent messages (default: 25)
mxroute mail inbox -c 50               # List 50 messages
mxroute mail inbox -f Sent             # List messages in Sent folder
```

#### mail read -- Read Email

```bash
mxroute mail read <uid>                # Read email by UID
mxroute mail read <uid> -f Sent        # Read from specific folder
```

#### mail compose -- Send New Email

```bash
mxroute mail compose -t user@example.com -s "Subject" -b "Body"
mxroute mail compose -t user@example.com -s "Hi" -b "Body" --cc cc@example.com --bcc bcc@example.com
mxroute mail compose -t user@example.com -s "Hi" -b "Body" -a file.pdf -a image.png
```

#### mail reply / forward -- Respond to Email

```bash
mxroute mail reply <uid> -b "Reply body"
mxroute mail forward <uid> -t other@example.com
mxroute mail forward <uid> -t other@example.com -n "FYI, see below"
```

#### mail search -- Search Emails

```bash
mxroute mail search "keyword"          # Search subject, from, body
mxroute mail search "keyword" -f Sent  # Search specific folder
mxroute mail search "keyword" -l 100   # Limit results
```

#### mail delete / move -- Manage Messages

```bash
mxroute mail delete <uid>              # Delete message
mxroute mail move <uid> -d Archive     # Move to folder
```

#### mail mark -- Read/Unread/Flag Status

```bash
mxroute mail mark-read <uid>           # Mark as read
mxroute mail mark-unread <uid>         # Mark as unread
```

#### mail folders -- Folder Management

```bash
mxroute mail folders                   # List all folders
mxroute mail folder-create "Projects"  # Create folder
mxroute mail folder-delete "Projects"  # Delete folder
```

#### mail unread -- Quick Unread Count

```bash
mxroute mail unread                    # Unread count in INBOX
mxroute mail unread -f "Custom Folder" # Unread count in custom folder
```

#### mail save-attachment -- Download Attachments

```bash
mxroute mail save-attachment <uid>     # Save all attachments
mxroute mail save-attachment <uid> -i 0 -o ./downloads  # Save specific attachment
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

### Business Provisioning

Tools for onboarding and offboarding employees, bulk account setup, and credential distribution.

#### password -- Self-Service Password Change

```bash
mxroute password                       # Change your own email password (verifies current password via IMAP first)
```

#### provision -- Manifest-Based Provisioning

Provision an entire company from a single JSON manifest file.

```bash
mxroute provision plan manifest.json   # Dry-run: show what would be created or skipped
mxroute provision apply manifest.json  # Execute: create all accounts, forwarders, and settings
mxroute provision generate [domain]    # Generate a manifest from existing domain config
```

**Example manifest:**
```json
{
  "company": "Acme Corp",
  "domains": [{
    "name": "acme.com",
    "accounts": [
      { "user": "alice", "quota": 5000 },
      { "user": "bob", "quota": 2000 }
    ],
    "forwarders": [
      { "from": "info", "to": "alice@acme.com" },
      { "from": "support", "to": "bob@acme.com" }
    ]
  }]
}
```

Accounts without a `password` field get a random 16-character password generated automatically.

#### welcome-send -- Welcome Emails

```bash
mxroute welcome-send [domain]          # Send setup instructions to selected accounts
```

Sends branded HTML emails with IMAP/SMTP settings, webmail links, and client setup guides (Outlook, Apple Mail, Thunderbird, mobile).

#### credentials-export -- Credential Distribution

```bash
mxroute credentials-export [domain]    # Export account info as CSV, 1Password CSV, or JSON
```

Output includes email addresses, server settings, and connection details. Files written with `0600` permissions.

#### deprovision -- Employee Offboarding

```bash
mxroute deprovision [domain]           # Offboard an account: forward, auto-reply, or delete
```

Options:
- Forward emails to another employee's account
- Set auto-reply + forwarding (transition period)
- Delete immediately

#### quota-policy -- Role-Based Quotas

```bash
mxroute quota-policy apply [domain]    # Apply uniform or per-role quotas
mxroute quota-policy generate [domain] # Generate sample policy file
```

**Example policy file:**
```json
{
  "rules": [
    { "pattern": "admin*", "quota": 10000 },
    { "pattern": "*", "quota": 2000 }
  ]
}
```

---

### Utilities

#### ssl-check -- SSL/TLS Certificate Check

```bash
mxroute ssl-check                      # Check SSL certs on IMAP/SMTP/POP3/DirectAdmin ports
mxroute ssl-check example.com          # Check specific hostname
```

#### reputation -- Domain Reputation Check

```bash
mxroute reputation                     # Check SPF/DKIM/DMARC/MX/blacklist scoring
mxroute reputation example.com         # Check specific domain
```

#### test-delivery -- Delivery Test

```bash
mxroute test-delivery                  # Send test email and measure delivery time
```

#### rate-limit -- Rate Limit Status

```bash
mxroute rate-limit                     # Check sending rate against 400/hr limit
```

#### accounts-search -- Cross-Domain Account Search

```bash
mxroute accounts-search <query>        # Search accounts across all domains
```

#### cleanup -- Configuration Cleanup Audit

```bash
mxroute cleanup                        # Find orphaned forwarders, autoresponders, conflicts
```

#### password-audit -- Password Strength Check

```bash
mxroute password-audit                 # Audit account passwords for weak patterns
```

#### header-analyze -- Email Header Analysis

```bash
mxroute header-analyze                 # Parse and analyze email headers for routing/auth/spam info
```

#### templates -- Email Templates

```bash
mxroute templates list                 # List saved templates
mxroute templates save <name>          # Save a new template
mxroute templates send <name>          # Send using a template with variable substitution
mxroute templates delete <name>        # Delete a template
```

#### usage-history -- Usage Trends

```bash
mxroute usage-history                  # Show current usage with historical trends and sparklines
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

The `mxroute-mcp` binary exposes 78+ tools via the [Model Context Protocol](https://modelcontextprotocol.io), allowing AI assistants to manage your MXroute account and operate as a full email agent.

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

**Account Management:** domains, email accounts, forwarders, autoresponders, catch-all, spam config, DNS records, DKIM keys, email filters, mailing lists, domain aliases, quota management, DNS health checks.

**DNS Provider Routing:** `list_dns_providers` -- list all supported DNS providers with credential status, showing which providers are configured and ready for automated record creation.

**Mail Client (IMAP/SMTP):** `list_messages`, `read_email`, `search_emails`, `send_email` (with CC/BCC), `reply_email`, `forward_email`, `delete_email`, `move_email`, `mark_email` (read/unread/flagged/unflagged), `get_unread_count`, `list_mail_folders`, `create_mail_folder`, `delete_mail_folder`, `download_attachment`.

**Bulk Operations:** `bulk_mark`, `bulk_delete`, `bulk_move` -- operate on multiple messages at once.

**Profile Management:** `list_profiles` -- discover configured accounts. All mail tools accept an optional `profile` parameter to target a specific account without switching the global profile.

**Security & Diagnostics:** `security_audit`, `check_reputation`, `ssl_check`, `password_audit`, `health_check`, `cleanup_audit`, `validate_forwarders`, `analyze_headers`.

**Utilities:** `test_delivery`, `check_rate_limit`, `search_accounts`, `export_config`, `usage_history`.

**Templates:** `list_templates`, `save_template`, `send_template`, `delete_template` -- email template CRUD with `{{variable}}` substitution.

**Business Provisioning:** `self_service_password`, `provision_plan`, `provision_execute`, `provision_generate`, `welcome_send`, `credentials_export`, `deprovision_account`, `quota_policy_apply` -- manifest-based bulk setup, credential distribution, employee offboarding, and role-based quotas.

### Multi-Account Usage (MCP)

AI agents can operate on multiple email accounts by passing the `profile` parameter:

```json
// List messages from the "work" profile
{ "tool": "list_messages", "arguments": { "profile": "work", "count": 10 } }

// Send email from the "personal" profile
{ "tool": "send_email", "arguments": { "profile": "personal", "to": "friend@example.com", "subject": "Hi", "body": "Hello!" } }

// Discover available profiles
{ "tool": "list_profiles", "arguments": {} }
```

---

## Automated DNS Setup

The `dns setup` command can automatically create all required MXroute DNS records at your registrar via API.

### Supported Providers

| Provider | API Support | Credentials Needed |
|---|---|---|
| **Cloudflare** | Full | API Token |
| **Porkbun** | Full | API Key + Secret Key |
| **DigitalOcean** | Full | API Token |
| **GoDaddy** | Full | API Key + API Secret |
| **Hetzner DNS** | Full | API Token |
| **Vercel DNS** | Full | Bearer Token |
| **Namecheap** | Limited* | API Key + Username |
| **AWS Route53** | Detection only† | Access Key ID + Secret + Region |
| **Google Cloud DNS** | Detection only† | Service Account JSON + Project ID |

\* Namecheap's API requires IP whitelisting and only supports domains registered through Namecheap.

† Detection only: the provider is auto-detected from your nameservers for routing purposes, but automated record creation is not supported. Use the AWS CLI or `gcloud` to apply the generated records.

### Provider Routing

The CLI can auto-detect your DNS provider by querying your domain's nameservers, then automatically route operations to the right provider:

```bash
# Auto-detect and route DNS setup
mxroute dns setup example.com

# List all configured providers and their credential status
mxroute dns providers

# Pre-configure credentials for a specific provider
mxroute dns providers-setup cloudflare
mxroute dns providers-setup porkbun
```

Provider credentials are stored per-provider under `providers` in your config file and reused automatically on subsequent runs.

### Usage

```bash
mxroute dns setup example.com
```

The wizard will:
1. Ask which provider manages your DNS
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

150+ tests across 24+ test files covering API, audit, benchmark, blacklist, CLI, completions, config, diff, DirectAdmin, DNS, IMAP, mail/MIME, MCP, monitor, provisioning, share, theme, and webhook functionality.

### Code Quality

- ESLint and Prettier enforce consistent style
- Husky pre-commit hooks run lint-staged on every commit
- GitHub Actions CI validates on Node.js 20 and 22
- Tag-based release workflow publishes to npm with provenance

### Project Structure

```
src/
  index.ts              # CLI entry point (Commander.js)
  mcp.ts                # MCP server entry point (78+ tools)
  commands/             # 50 command modules (includes mail client)
  utils/                # Shared utilities (API, config, DNS, DirectAdmin, IMAP, MIME, registrars)
tests/                  # 24+ test files (Vitest)
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
