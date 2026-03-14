# mxroute-cli

A powerful CLI for managing [MXroute](https://mxroute.com) email hosting -- full account management, DNS verification, email sending, spam configuration, troubleshooting, and more via the DirectAdmin API.

```
   __  ____  __                _
  |  \/  \ \/ /_ __ ___  _   _| |_ ___
  | |\/| |\  /| '__/ _ \| | | | __/ _ \
  | |  | |/  \| | | (_) | |_| | ||  __/
  |_|  |_/_/\_\_|  \___/ \__,_|\__\___|

  Email Hosting Management CLI
```

## Features

- **Full account management** -- domains, email accounts, forwarders, autoresponders, mailing lists, domain aliases
- **DNS management** -- health checks (MX, SPF, DKIM, DMARC), record management via API, DKIM key retrieval, zone file generation
- **Email sending** -- send emails via MXroute's SMTP API with interactive composer or CLI flags
- **Spam control** -- SpamAssassin configuration, catch-all addresses, email filters
- **Quota monitoring** -- disk usage, bandwidth, account counts with visual progress bars
- **Troubleshooting** -- interactive wizard covering 10 common issue categories
- **Connection reference** -- IMAP/SMTP/POP3 ports, webmail URLs, CalDAV/CardDAV setup, client guides
- **Multi-profile support** -- manage multiple MXroute accounts from one CLI
- **Secure config** -- credentials stored with `0600` permissions in `~/.config/mxroute-cli/`

## Install

```bash
npm install -g mxroute-cli
```

## Quick Start

```bash
# 1. Configure SMTP credentials (for sending email)
mxroute config setup

# 2. Authenticate with DirectAdmin API (for account management)
mxroute auth login

# 3. Check your DNS records
mxroute dns check

# 4. View full account status dashboard
mxroute status
```

### Getting Your Credentials

The CLI uses two types of credentials:

| Credential | Purpose | Where to find |
|---|---|---|
| **Server hostname** | Identifies your MXroute server | Control Panel (panel.mxroute.com) -> DNS section. Looks like `tuesday`, `fusion`, etc. |
| **Email + password** | SMTP API (sending email) | Your email account credentials (same as email client login) |
| **DirectAdmin username** | API authentication | Your DirectAdmin login username |
| **Login Key** | API authentication (recommended over password) | Control Panel -> Login Keys -> Create new key |

> **Why Login Keys?** They're more secure than passwords -- you can restrict permissions, set expiry dates, and revoke them without changing your password.

---

## Command Reference

### Authentication

Authenticate with the DirectAdmin API to unlock account management commands.

```bash
mxroute auth login          # Interactive login with Login Key
mxroute auth status         # Verify stored credentials are valid
mxroute auth logout         # Remove stored credentials
```

**Example:**
```bash
$ mxroute auth login
? Server hostname: fusion
? DirectAdmin username: myuser
? Login Key: ••••••••
✔ Authentication successful!
```

### Configuration & Profiles

Configure SMTP credentials for sending email. Supports multiple profiles for managing different accounts.

```bash
mxroute config setup        # Interactive configuration wizard
mxroute config show         # Show current active configuration
mxroute config profiles     # List all saved profiles
mxroute config switch       # Switch between profiles (interactive)
mxroute config switch work  # Switch to a named profile
mxroute config delete       # Delete a profile (interactive)
mxroute config delete old   # Delete a named profile
```

**Example -- multiple profiles:**
```bash
$ mxroute config setup      # Creates "default" profile
$ mxroute config setup      # Enter "work" as profile name
$ mxroute config switch     # Pick which profile to use
```

### Status Dashboard

Get a complete overview of your account in one command.

```bash
mxroute status              # Full dashboard: account info, DNS health, API test
mxroute                     # Same as status (default command)
```

Shows: active profile, server, account, domain, DNS health scores for MX/SPF/DKIM/DMARC/CNAME, and SMTP API connectivity test.

---

### Domains

List and inspect domains on your MXroute account.

```bash
mxroute domains list                    # List all domains with alias counts
mxroute domains info                    # Show details for configured domain
mxroute domains info example.com        # Show details for specific domain
```

### Email Accounts

Create, list, delete, and manage passwords for email accounts.

```bash
mxroute accounts list                   # List accounts (prompts for domain if multiple)
mxroute accounts list example.com       # List accounts for specific domain
mxroute accounts create                 # Interactive account creation
mxroute accounts create example.com     # Create account on specific domain
mxroute accounts delete example.com     # Delete an account (picks from list)
mxroute accounts passwd example.com     # Change password (picks from list)
```

Aliases: `accounts add` = `accounts create`, `accounts rm` = `accounts delete`, `accounts password` = `accounts passwd`

**Example -- creating an account:**
```bash
$ mxroute accounts create example.com
? Username (before @example.com): info
? Password: ••••••••
? Confirm password: ••••••••
? Quota in MB (0 = unlimited): 0
? Create info@example.com? Yes
✔ Created info@example.com
```

### Email Forwarders

Redirect email from one address to another.

```bash
mxroute forwarders list [domain]        # List all forwarders
mxroute forwarders create [domain]      # Create a forwarder (interactive)
mxroute forwarders delete [domain]      # Delete a forwarder (picks from list)
```

Aliases: `fwd list`, `fwd create`, `fwd delete`; `forwarders add`, `forwarders rm`

### Autoresponders / Vacation Messages

Set up automatic replies for email accounts (e.g., "I'm out of office").

```bash
mxroute autoresponder list [domain]     # List all autoresponders
mxroute autoresponder create [domain]   # Create autoresponder (picks account, opens editor)
mxroute autoresponder edit [domain]     # Edit existing autoresponder message
mxroute autoresponder delete [domain]   # Delete an autoresponder
```

Aliases: `vacation list`, `vacation create`, `vacation edit`, `vacation delete`

### Catch-All / Default Address

Control what happens to email sent to non-existent addresses on your domain.

```bash
mxroute catchall get [domain]           # Show current catch-all setting
mxroute catchall set [domain]           # Configure catch-all (interactive)
```

**Catch-all options:**
- **Forward to existing account** -- picks from your email accounts
- **Forward to custom email** -- any external address
- **Reject** (`:fail:`) -- bounce back to sender
- **Disable** (`:blackhole:`) -- silently discard

### SpamAssassin

Configure server-side spam filtering per domain.

```bash
mxroute spam status [domain]            # Show current SpamAssassin config
mxroute spam enable [domain]            # Enable with defaults (score 5, spam folder)
mxroute spam disable [domain]           # Disable SpamAssassin
mxroute spam config [domain]            # Interactive configuration wizard
```

Aliases: `spam on` = `spam enable`, `spam off` = `spam disable`, `spam show` = `spam status`

**`spam config` options:**
- **Required score** (1-10) -- lower = more aggressive filtering
- **Spam delivery** -- move to spam folder, leave in inbox, or delete
- **High score threshold** -- separate action for very high scoring spam
- **High score action** -- what to do with high-scoring spam

> **Note:** MXroute also has "Expert Spam Filtering" which is separate from SpamAssassin. Manage it at Management Panel -> Spam Filters.

### Email Filters

Create per-account email filtering rules (server-side).

```bash
mxroute filters list [domain]           # List filters (picks account)
mxroute filters create [domain]         # Create a filter (interactive)
mxroute filters delete [domain]         # Delete a filter (picks from list)
```

**Filter options:**
- **Match field**: from, to, subject, body
- **Match type**: contains, equals, starts with, ends with
- **Actions**: discard, forward to address, move to folder

### Mailing Lists

Create and manage mailing lists for group communication.

```bash
mxroute lists list [domain]             # List all mailing lists
mxroute lists create [domain]           # Create a new mailing list
mxroute lists delete [domain]           # Delete a mailing list
mxroute lists members [domain]          # Show members of a list
mxroute lists add-member [domain]       # Add a member to a list
mxroute lists remove-member [domain]    # Remove a member from a list
```

Aliases: `mailinglist list`, `lists ls`, `lists add`, `lists rm`

### Domain Aliases / Pointers

Make one domain share all email accounts with another domain.

```bash
mxroute aliases list [domain]           # List domain aliases/pointers
mxroute aliases add [domain]            # Add a domain alias
mxroute aliases remove [domain]         # Remove a domain alias
```

> **How aliases work:** If `primary.com` has `user@primary.com`, adding `alias.com` as a pointer means `user@alias.com` will also work -- all accounts are shared.

### Quota & Usage

Monitor disk usage, bandwidth, and resource limits.

```bash
mxroute quota                           # Account-wide usage overview with progress bars
mxroute quota-set [domain]              # Set quota for a specific email account
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

Two approaches to DNS: **health checks** (read-only, queries public DNS) and **record management** (read/write, via DirectAdmin API).

#### DNS Health Check

Verify your domain's DNS records are correctly configured for MXroute by querying public DNS servers.

```bash
mxroute dns check                       # Check configured domain
mxroute dns check example.com           # Check specific domain
mxroute dns records                     # Show required DNS records for your server
mxroute dns records example.com         # Show for specific domain
mxroute dns generate                    # Generate zone file (picks DNS provider)
mxroute dns generate example.com        # Generate for specific domain
```

**What `dns check` verifies:**
- **MX** -- primary and relay records pointing to your MXroute server
- **SPF** -- `v=spf1 include:mxroute.com -all` present, single record, hard fail
- **DKIM** -- `x._domainkey` TXT record with valid DKIM1 key
- **DMARC** -- `_dmarc` TXT record with quarantine or reject policy
- **CNAME** -- custom hostnames for mail/webmail (optional)

**`dns generate` supports:**
- Cloudflare (with proxy-off warning)
- Namecheap
- Route53 / AWS (with quoting notes)
- Generic / other providers

#### DNS Records (via DirectAdmin API)

Manage DNS records directly on your MXroute server. Requires authentication (`mxroute auth login`).

```bash
mxroute dnsrecords list [domain]        # List all DNS records from server
mxroute dnsrecords add [domain]         # Add a record (A, AAAA, CNAME, MX, TXT, SRV)
mxroute dnsrecords delete [domain]      # Delete a DNS record
mxroute dnsrecords dkim [domain]        # Retrieve the full DKIM key for your domain
```

Aliases: `dnsapi list`, `dnsapi add`, etc.

---

### Send Email

Send email via MXroute's SMTP API. Requires SMTP configuration (`mxroute config setup`).

```bash
mxroute send                                                    # Interactive composer (opens editor for body)
mxroute send -t user@example.com -s "Subject" -b "Body text"   # Send with flags
mxroute send -t user@example.com -s "Hi" --html -b "<h1>Hello</h1>"  # HTML body
mxroute send -f alias@example.com -t user@example.com -s "Hi" -b "Body"  # Custom from
mxroute test                                                     # Send a test email to yourself
```

**Options:**
| Flag | Description |
|---|---|
| `-t, --to <email>` | Recipient email address |
| `-s, --subject <text>` | Email subject line |
| `-b, --body <text>` | Email body content |
| `-f, --from <email>` | Sender address (defaults to configured username) |
| `--html` | Treat body as raw HTML (otherwise auto-wrapped) |

**SMTP API limitations:**
- 400 emails per hour per email address
- Single recipient per request
- No file attachments
- Body size limit ~10MB
- Marketing/promotional email is prohibited

### Connection Info

Quick reference for email client settings, webmail URLs, and service details.

```bash
mxroute info connections                # IMAP/SMTP/POP3 ports table
mxroute info webmail                    # Webmail URLs (Crossbox, Roundcube)
mxroute info caldav                     # CalDAV/CardDAV server and setup guides
mxroute info api                        # SMTP API endpoint, fields, and limits
mxroute info limits                     # Service limits and policies
mxroute info panels                     # Management and Control Panel URLs
mxroute info all                        # Everything at once
```

**Email client setup guides:**
```bash
mxroute info client ios                 # Apple Mail (iPhone/iPad)
mxroute info client outlook             # Microsoft Outlook
mxroute info client thunderbird         # Mozilla Thunderbird
mxroute info client generic             # Generic IMAP/SMTP settings
```

**Connection settings reference:**

| Protocol | Port | Encryption | Recommended |
|---|---|---|---|
| IMAP | 993 | SSL/TLS | Yes |
| IMAP | 143 | STARTTLS | Alternative |
| POP3 | 995 | SSL/TLS | Yes |
| POP3 | 110 | STARTTLS | Alternative |
| SMTP | 465 | SSL/TLS | Yes |
| SMTP | 587 | STARTTLS | Alternative |
| SMTP | 2525 | STARTTLS | If 587 blocked |

### Troubleshooting

Interactive troubleshooting wizard that walks you through diagnosing and fixing common issues.

```bash
mxroute troubleshoot                    # Launch interactive wizard
mxroute diagnose                        # Alias
```

**Covers 10 issue categories:**
1. **Emails going to spam (Gmail)** -- mail-tester, DNS checks, filter training, Postmaster Tools
2. **Emails going to spam (Microsoft)** -- Microsoft-specific steps, SNDS reputation
3. **Cannot connect to server** -- ports, firewall, ISP blocking, live connection test
4. **Authentication failures** -- username format, password reset, encryption settings
5. **Emails not being delivered** -- DNS check, sender verification, bounce analysis
6. **DNS configuration issues** -- common mistakes checklist, live DNS check
7. **SSL certificate warnings** -- CNAME setup, certificate request steps
8. **Common error messages** -- 550 Auth Required, Sender Verify Failed, 5.7.515, etc.
9. **Migration issues** -- imapsync command, step-by-step migration guide
10. **Spam filter blocking legitimate mail** -- whitelist requests, filter toggle

---

## Configuration

### Config file

Configuration is stored at `~/.config/mxroute-cli/config.json` with file permissions `0600` (owner-only read/write).

```bash
mxroute config show                     # View current config (passwords masked)
```

### Two credential types

| Type | Used for | Command | Required for |
|---|---|---|---|
| **SMTP credentials** | Sending email | `mxroute config setup` | `send`, `test` |
| **DirectAdmin Login Key** | Account management | `mxroute auth login` | `domains`, `accounts`, `forwarders`, `autoresponder`, `catchall`, `spam`, `dnsrecords`, `filters`, `lists`, `aliases`, `quota` |

Commands that only read public DNS (`dns check`, `dns records`, `dns generate`) and display static info (`info`, `troubleshoot`) work without any credentials -- just a server name.

### Multiple profiles

Manage different MXroute accounts from one CLI:

```bash
# Create profiles
mxroute config setup                    # First run creates "default" profile
mxroute config setup                    # Enter "work" as profile name for second

# Switch between them
mxroute config switch                   # Interactive picker
mxroute config switch work              # Switch by name
mxroute config profiles                 # List all profiles

# Delete a profile
mxroute config delete old               # Delete by name
```

---

## MXroute Panels

| Panel | URL | Purpose |
|---|---|---|
| **Management Panel** | https://management.mxroute.com | Subscriptions, invoices, payment, support tickets |
| **Control Panel** | https://panel.mxroute.com | Email accounts, forwarders, domains, DNS, spam, webmail |
| **Whitelist Request** | https://whitelistrequest.mxrouting.net | Request IP/domain whitelist for spam filter |

## Requirements

- Node.js >= 18
- An [MXroute](https://mxroute.com) email hosting account

## License

MIT
