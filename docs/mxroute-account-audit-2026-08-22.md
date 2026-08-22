# MXroute Account and CLI Audit

**Audit date:** 2026-08-22
**Mode:** Read-only
**Account server:** `fusion.mxrouting.net`
**Supporting research:** [Current MXroute recommendations](./mxroute-current-recommendations.md)

## Overall Assessment

The account is operational and has a strong DNS baseline. DirectAdmin authentication, mailbox access, SMTP submission, and the OpenCode MCP integration work. All four domains have valid MX, strict SPF, and DKIM. Three domains enforce DMARC; one is monitoring only. Catch-all delivery is rejected on every domain. The CLI's security audit scored the account 92/100.

The most important updates are to establish independent mailbox backups, move `faithburst.com` toward DMARC enforcement after validating its senders, and migrate the CLI away from DirectAdmin login keys to MXroute's current API-key interface. The project dependencies also need a security refresh.

## Implementation Status

Work on `chore/mxroute-audit-updates` has addressed the application findings without changing the live account:

- Added the current `api.mxroute.com` client with separate API credentials, timeouts, structured errors, bounded retries, and write pacing.
- Added an explicit management seam that uses the current API for supported operations and legacy DirectAdmin only for capabilities absent from the current API.
- Preserved existing DirectAdmin configurations; migration to an API key is explicit through `mxroute config setup`.
- Fixed object-shaped DirectAdmin forwarder responses, removing the false orphaned-domain warning.
- Updated the dependency lockfile to resolve all reported npm vulnerabilities.
- Added behavior-level regression tests for API transport, backend selection, credential migration, and forwarder normalization.

Operational findings such as independent backups, `faithburst.com` DMARC enforcement, panel 2FA, Expert Spam Filtering, and webmail-user migration remain account-owner actions.

## Current Inventory

| Item | Observed state |
|---|---|
| Domains | 4: `andrewadhikari.com`, `faithburst.com`, `overflowcup.com`, `voyagerslab.com` |
| Mailboxes | 35 total |
| Forwarders | 1 total |
| Storage | 15.5 MB of 100 GB reported by the API |
| Bandwidth | 1.45 MB; unlimited allocation |
| DirectAdmin API | Authenticated and working on Fusion |
| Mailbox access | IMAP authenticated successfully |
| Sending | SMTP sending connection succeeded |
| OpenCode MCP | Connected |
| Catch-all | Reject/disabled on all four domains |
| Local mailbox backup | No evidence of a configured backup or backup schedule |
| Monitoring schedule | No user crontab installed |

MXroute says the current panel/API quota figure is authoritative and that Fusion uses Dovecot 2.4 quota accounting. Current use is far below the plan limit, so no storage upgrade is indicated. See [S18], [S21], and [S25] in the supporting research.

## DNS and Deliverability

| Domain | MX | SPF | DKIM | DMARC | Custom mail/webmail CNAMEs |
|---|---|---|---|---|---|
| `andrewadhikari.com` | Pass | Pass, hard fail | Pass | `p=quarantine` | Pass |
| `faithburst.com` | Pass | Pass, hard fail | Pass | `p=none` | Pass |
| `overflowcup.com` | Pass | Pass, hard fail | Pass | `p=quarantine` | Pass |
| `voyagerslab.com` | Pass | Pass, hard fail | Pass | `p=quarantine` | Pass |

All SPF records use MXroute with a hard fail and only one include, safely below SPF's ten-lookup limit. All custom webmail CNAMEs currently point to `fusion.mxrouting.net`.

The `mail.voyagerslab.com` certificate was directly tested on IMAP 993, SMTP 465, POP3 995, and DirectAdmin 2222. It is a valid Let's Encrypt TLS 1.3 certificate expiring 2026-11-02 and is expected to renew automatically. Other domain certificates were not directly tested in this audit.

### Update: DMARC Enforcement for `faithburst.com`

`faithburst.com` currently publishes only `v=DMARC1; p=none;`. MXroute recommends DMARC and supports moving from monitoring toward enforcement after all legitimate senders have been validated. The record should not be changed blindly: first confirm every service that sends as `faithburst.com` aligns through SPF or DKIM, review aggregate reports if available, then move gradually to `quarantine` and eventually `reject` if appropriate. See [S7]-[S9] in the supporting research.

Priority: **Medium**. This is a spoofing-protection and deliverability improvement, not a current MXroute contractual failure.

### Update: Legacy Custom Webmail Hostnames

The custom `webmail.<domain>` CNAMEs are valid today, but MXroute has announced a transition away from Roundcube and recommends its current in-house webmail at `https://webmail.mxroute.com`. Do not remove working records immediately. First identify users or documentation that rely on the custom URLs, update those references, and treat the CNAMEs as transitional. See [S13] and [S14].

Priority: **Low/Transitional**.

## Forwarder Finding

The only forwarder is `hello@voyagerslab.com` to `andrew@voyagerslab.com`. This is not a forwarding loop by itself.

The CLI's audit and cleanup warnings are partly false positives. DirectAdmin returned the destination as an object shaped like `{"hello":["andrew@voyagerslab.com"]}`. `getForwarderDestination()` stringifies unknown objects at `src/utils/directadmin.ts:178-185`; `cleanupCommand()` then splits that JSON as though it were a plain comma-separated email at `src/commands/cleanup.ts:70-111`. This produces the bogus destination domain `voyagerslab.com"]}` and the bogus “no MX records” warning.

There is a separate, legitimate configuration question: a mailbox and forwarder both exist for `hello`. Verify with a test message whether the intended behavior is local delivery plus forwarding to Andrew. Do not delete either object based on the current cleanup output alone.

Priority: **Medium for the CLI bug; Low for manual behavior verification**.

## Spam Filtering

The legacy DirectAdmin SpamAssassin status reports disabled on all four domains, with a score of 15 and delete action retained in the legacy configuration. That does not reveal the separate Expert Spam Filtering state.

MXroute states that all spam filtering may not be disabled and that Expert Spam Filtering is enabled by default. Confirm in **Management Panel > Spam Filters** that Expert Spam Filtering remains enabled for each domain. Do not enable the old “deliver spam to spam folder” behavior through DirectAdmin; MXroute removed it from the current panel because it can mishandle forwarded mail. See [S26]-[S28].

Priority: **Medium manual verification**. The audit did not establish that filtering is absent, only that legacy SpamAssassin is disabled.

## Authentication and API Migration

The CLI currently stores and uses a DirectAdmin login key and calls `https://<server>:2222/CMD_API_*`. DirectAdmin coupling is broad: account, domain, forwarder, DNS, quota, spam, provisioning, audit, and MCP operations import `src/utils/directadmin.ts`. Searches found no implementation of the current `api.mxroute.com` account-management API or its `X-Server`, `X-Username`, and `X-API-Key` headers.

MXroute launched its public API in May 2026 and announced its intention to move away from DirectAdmin in July 2026. Fusion still accepts the legacy API today, but the CLI is exposed to a future service migration. New automation should use a purpose-specific API key from **Control Panel > Advanced > API Keys**, respect the documented read/write rate limits, and avoid retaining an obsolete DirectAdmin key after migration. See [S13], [S18], and [S21].

Priority: **High for the application roadmap**. This is not an immediate outage on Fusion, but it is the largest compatibility risk.

Also verify manually that 2FA is enabled for `management.mxroute.com` and `panel.mxroute.com`, and inventory/revoke unused API or legacy login keys. The CLI cannot inspect these controls safely.

## Backups and Recovery

No mailbox backup files, configured mailbox backup job, or user crontab were found. The CLI's “auto-backups” only snapshot configuration before destructive CLI operations; they are not mailbox-content backups. Its `mail-backup` command merely generates `imapsync` commands and scripts.

MXroute explicitly says provider backups are a best-effort hardware-failure courtesy and are not guaranteed customer backups. Establish an independent encrypted backup for important mailboxes, schedule it, retain logs, and perform a restore test. See [S8] and the backup guidance in the supporting research.

Priority: **High**.

## CLI Dependency and Maintenance State

The checked-out and npm-published version are both `1.2.3`; the repository is not behind its published package. However:

- `npm audit --omit=dev` reports 12 runtime vulnerabilities: 1 low, 3 moderate, 7 high, and 1 critical.
- Affected runtime packages include transitive Hono/MCP dependencies, `js-yaml`, `lodash`, `shell-quote`, and `ws`.
- Several dependencies have compatible updates available, including `@modelcontextprotocol/sdk` 1.30.0, `js-yaml` 4.3.1, and `zod` 4.4.3.
- Full CI builds and type-checks successfully; 439 of 440 tests pass. The remaining live Hetzner invalid-credential test unexpectedly returns true.

Update dependencies in a reviewed branch, rerun `npm audit --omit=dev` and the full CI suite, and specifically regression-test the MCP server and provider integrations. Do not expose the webhook publicly before addressing applicable server-side advisories.

Priority: **High for security maintenance**.

## Recommended Order

1. Establish and restore-test independent mailbox backups.
2. Update vulnerable CLI dependencies and fix the forwarder response parser/tests.
3. Add support for MXroute's current API-key API, migrate operations, then revoke the legacy DirectAdmin key when no longer needed.
4. Validate all `faithburst.com` senders and advance DMARC from monitoring toward enforcement.
5. Confirm Expert Spam Filtering and panel/management 2FA manually.
6. Test the `hello@voyagerslab.com` mailbox-plus-forwarder behavior before changing it.
7. Transition users and documentation from custom legacy webmail URLs to `webmail.mxroute.com` when appropriate.

## No Change Needed Now

- MX and SPF satisfy MXroute's documented policy floor on all four domains.
- DKIM is present and valid on all four domains.
- Three domains already enforce DMARC with `quarantine`.
- Catch-all rejection is a sound anti-abuse configuration.
- Storage consumption is negligible relative to the 100 GB plan.
- Current Fusion DirectAdmin and mail connections are operational.
- The tested custom mail certificate is valid and uses TLS 1.3.

## Evidence Limits

This read-only audit could not verify management-panel 2FA, Expert Spam Filtering state, API-key inventory, actual peak hourly sending volume, recipient complaint rates, backup systems outside this machine, or user reliance on Crossbox/Roundcube. Those remain manual review items.
