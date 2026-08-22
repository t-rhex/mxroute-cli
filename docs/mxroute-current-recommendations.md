# MXroute Existing-Account Audit: Current Official Recommendations

**Research date:** 2026-08-22
**Scope:** Public, first-party MXroute documentation, policy, changelog, blog, status, API specification, and archived official documentation. No account credentials or private account data were accessed, and no account changes were made.

## Executive Summary

For a current account audit, treat the values shown for the specific service in `panel.mxroute.com` as authoritative. MX targets and DKIM keys are server/domain-specific and should not be copied from generic examples. MXroute's revised Terms require valid MX and SPF records on every domain that sends through the service. Current documentation strongly recommends DKIM and DMARC, but does not describe them as universal MXroute contractual requirements. New domains must pass DNS ownership verification before being added.

Use the service's primary MX hostname, or a properly provisioned custom `mail.<domain>` CNAME, for IMAP/SMTP. Supported ports are IMAP 993 (TLS) or 143 (non-SSL/STARTTLS), POP3 995 or 110, and SMTP 465 (TLS) or 25/587/2525 (non-SSL/STARTTLS). Authentication uses the full email address and mailbox password. Prefer encrypted connections and SMTP authentication.

MXroute 4.x is moving away from DirectAdmin, Crossbox, and Roundcube. Existing DirectAdmin-era services may still expose DirectAdmin, but new infrastructure can omit it entirely. Current automation should use a dedicated API key created in the MXroute control panel, not a primary DirectAdmin password or an old DirectAdmin login key. Audit and retire unused legacy keys without exposing their values.

The hard sending ceiling is 400 outbound messages per hour per email address; creating addresses to evade it is prohibited. Marketing, cold outreach, warmup services, and unsolicited mail are prohibited. Storage is plan-limited. Provider backups are a best-effort hardware-failure courtesy, not guaranteed customer backups. Maintain an independent backup if recovery matters.

## Classification Used in This Note

- **Required:** Stated as required, prohibited, or an enforced service/policy condition by MXroute.
- **Recommended:** MXroute guidance or a conservative audit control, but not stated as a universal service condition.
- **Optional:** Supported configuration that depends on the account's needs.
- **Transitional:** Current behavior differs by server generation or is announced as changing.

## Audit Checklist

### DNS and Domain Ownership

| Check | Classification | Current guidance |
|---|---|---|
| MX records | **Required for sending domains; operationally required to receive at MXroute** | Compare every domain with the two server-specific MX records displayed under **Control Panel > DNS**. The generic examples use priorities 10 and 20, but their hostnames are examples only. Remove stale MX records unless intentionally routing elsewhere. [S1][S2][S3] |
| SPF | **Required for domains that send through MXroute** | Publish one SPF TXT record authorizing MXroute. Current recommended form is `v=spf1 include:mxroute.com -all`; `include:mxlogin.com` is documented as equivalent. Merge other legitimate senders into the single SPF record and stay within the 10-lookup limit. [S2][S3][S4] |
| DKIM | **Strongly recommended** | Publish the unique value shown for each domain in **Control Panel > DNS**, normally at `x._domainkey`. Do not reuse another domain's key or rely on a sample value. MXroute changed signing in 2023 so signing follows the authenticated domain, making sender/authentication alignment important. [S2][S5][S6] |
| DMARC | **Recommended for all domains; externally required for some bulk-delivery scenarios** | Start with MXroute's safe monitoring record, `v=DMARC1; p=none; sp=none; adkim=r; aspf=r;`, validate all senders, then consider gradual enforcement. Reporting is optional. Do not forward reports to Gmail. The revised Terms separately prohibit “Sending DMARC reports through us”; do not operate a report-generating/sending service over MXroute, and ask support if a proposed workflow is ambiguous. [S7][S8][S9] |
| Domain verification | **Required for newly added domains** | Before adding a new domain, publish the account-specific TXT verification record shown by the control panel/API. Existing domains predating the June 18, 2025 rollout were not retroactively affected. The verification record may be removed after the domain is added. [S3][S10][S11] |
| DNS tester | **Recommended** | Use the control panel's DNS Tester to validate MX, SPF, and DKIM after propagation. DNS changes may take up to 24-48 hours, although verification often completes sooner. [S2][S3] |

#### MX and SPF Are the Explicit Policy Floor

The Terms revised June 1, 2026 state that valid SPF and MX records are required on domains that send through MXroute. Incorrect DNS is not considered a provider service failure. DKIM and DMARC materially improve authentication and deliverability, but the current public wording is “highly recommended” or “recommended,” not a universal contractual requirement. [S8]

#### Custom Mail and Webmail Hostnames

Custom hostnames are optional. If used, MXroute currently documents:

```text
mail.example.com     CNAME  <the service's primary MX/server hostname>
webmail.example.com  CNAME  <the service's primary MX/server hostname>
```

Use CNAMEs, not A records, because server IP addresses may change. Then request Let's Encrypt certificates in **Control Panel > SSL Certificates** and use `mail.example.com` for IMAP/SMTP only after the certificate is installed. Check CAA records if issuance fails. `webmail.example.com` is documented for Roundcube, but Roundcube is now part of the announced third-party-software phaseout; the current in-house webmail is `https://webmail.mxroute.com`. [S12][S13][S14]

### IMAP, SMTP, and POP Settings

| Protocol | Encrypted port | Other supported ports | Authentication |
|---|---:|---:|---|
| IMAP | 993 (SSL/TLS) | 143 (non-SSL/STARTTLS) | Full email address and mailbox password |
| POP3 | 995 (SSL/TLS) | 110 (non-SSL/STARTTLS) | Full email address and mailbox password |
| SMTP | 465 (SSL/TLS) | 25, 587, 2525 (non-SSL/STARTTLS) | Full email address and mailbox password; SMTP authentication should be enabled |

The host is the account's mail-server hostname, normally the primary MX hostname shown in the control panel, or a certificate-backed custom `mail.<domain>` CNAME. MXroute supports IMAP, SMTP, and POP3 but does not support autoconfig/autodiscovery, so clients may require manual setup. All email is described as encrypted in transit. [S2][S15][S16]

**Audit recommendation:** Prefer IMAP 993 and SMTP 465, or a documented STARTTLS configuration on 587/2525. Do not accept a client silently falling back to cleartext. Verify SMTP authentication is enabled; Expert Spam Filtering rejects unauthenticated submissions from suspicious ranges. Port 25 is supported but is commonly filtered by access networks and should not be the default client-submission choice.

Traditional IMAP/POP/SMTP do not provide true 2FA at MXroute. MXroute recommends strong, unique mailbox passwords, password rotation, suspicious-activity monitoring, phishing caution, and updated clients/devices. Panel 2FA does not turn a mailbox password into two-factor protocol authentication. [S17]

### Panel, DirectAdmin, API, and Key Security

#### Current Access Model

- **Recommended current path:** Log into `management.mxroute.com`, select the service, and use **Login to Panel** for `panel.mxroute.com`. MXroute documents 2FA for both management and subscription-admin panels. [S1][S16]
- **Transitional:** MXroute 4.0 initially retained DirectAdmin for existing users, but the May 2026 `chocobo.mxrouting.net` launch was the first server with no user DirectAdmin access. On July 19, 2026 MXroute announced its intent to migrate away from DirectAdmin, Crossbox, and Roundcube and said older users had already been encouraged to stop accessing DirectAdmin directly. [S13][S18][S19]
- **Legacy caveat:** The archived official MXroute documentation told users to log directly into DirectAdmin with the primary control-panel username and password. That repository is now archived and is superseded by the 4.x panel guidance. [S20]

#### Login Keys and API Keys

The current MXroute public docs do not instruct customers to create or retain DirectAdmin login keys. MXroute now provides its own API, authenticated by `X-Server`, `X-Username`, and a dedicated `X-API-Key` created under **Control Panel > Advanced > API Keys**. Read operations are limited to 100/minute and writes to 20/minute. [S18][S21]

For an existing-account audit:

- **Recommended:** Inventory legacy DirectAdmin login keys by metadata only: purpose, owner, creation/last-use information if available, scope, and any source-IP restriction. Do not copy key secrets into audit output.
- **Recommended:** Revoke unused, unknown, shared, over-privileged, or orphaned keys through an approved change process.
- **Recommended:** For current automation, create a purpose-specific MXroute API key and store it in a secret manager; do not embed the primary panel password. Rotate/revoke it when its consumer is retired or compromised.
- **Required for API clients:** Send all three required authentication headers and respect the API rate limits. [S21]
- **Version caveat:** “DirectAdmin username” remains an API identifier even on the current API; it does not imply that direct DirectAdmin login remains available on every server. [S18][S21]

No key was viewed, tested, created, rotated, or revoked during this research.

### Sending Limits and Acceptable Use

#### Hard Limits and Prohibitions

- **400 outbound emails per hour per email address.** Creating additional addresses solely to multiply the limit is prohibited. [S8][S22]
- **No marketing email, cold outreach, warmup services, or unsolicited mail.** Attempts to circumvent the limit can lead to termination. [S8][S22][S23]
- **No sender spoofing:** Customers may not use a `From` domain they do not own or manage. [S8]
- **Human consumption:** Mail sent to other providers must be intended for humans, not excessive unread automation. [S8]
- **Invalid recipients and complaints:** Repeated sending to invalid recipients, spam complaints, or behavior that damages shared IP reputation can cause blocking or cancellation. [S8]
- **Message size:** The extended FAQ states a 50 MB total-message limit; encoded attachment payloads must be smaller. [S16]
- **Forwarder abuse:** The Terms prohibit forwarders configured in ways that frequently exceed 400 outbound messages/hour and prohibit large-scale forward-only service. [S8]

#### Documentation Conflict: Newsletters and Mailing Lists

Current first-party pages are inconsistent:

- The marketing-policy page says legitimate, non-promotional newsletters or customer updates are allowed. [S23]
- The core FAQ says marketing emails **or newsletters** are forbidden. [S24]
- The extended FAQ says mailing lists are unsupported. [S16]
- The revised Terms prohibit marketing email and mass mailing without double opt-in, while also stating all mailing lists must be double opt-in. [S8]

**Safe audit interpretation:** Treat newsletters, mailing lists, promotional content, and campaigns as unsupported/prohibited unless MXroute support confirms the exact use case in writing. Double opt-in is a minimum anti-spam condition, not permission to use MXroute as a marketing platform. Transactional application mail and ordinary business correspondence are expressly described as acceptable, subject to rate and abuse controls. [S16][S24]

### Storage, Quotas, and Backups

- **Required:** Stay within the storage allocation of the purchased plan and any mailbox quotas. The number of domains/accounts is generally unlimited within total storage, while account-level quotas can be set per mailbox. [S16][S24]
- **Current source of truth:** Use quota data in `panel.mxroute.com` or the MXroute API. It refreshes approximately hourly. DirectAdmin can display incorrect quota information. [S18][S21]
- **Dovecot 2.4 caveat:** MXroute reported on March 4, 2026 that Dovecot 2.4 counts uncompressed message size for enforcement, potentially making effective usable quota lower than physical compressed disk use. The named affected servers were Blizzard, Chocobo, Fusion, Sunfire, Taylor, and Wednesday, with the rest of the fleet expected to follow. The May 7 changelog says the new panel's quota display is accurate for enforced values. [S18][S25]
- **Backups are not guaranteed:** The Terms say accounts are backed up frequently for hardware failure, but backups are a courtesy and are not guaranteed. MXroute does not publish customer-facing retention, restore-point, or restore-SLA guarantees in the reviewed material. [S8]
- **Recommended:** Maintain an independent, tested copy of important mail. Do not treat MXroute's infrastructure backup as archival, point-in-time recovery, or a substitute for a customer-controlled backup.
- **Migration implication:** Upgrades to 100 GB or more on older legacy servers may require self-migration; Fusion, Glacier, Sunfire, and Witcher were listed as not requiring migration for upgrades. Verify this server list at the time of any future upgrade because it is operational guidance, not a permanent guarantee. [S16]

### Spam Filtering and Forwarding

- **Required/enforced:** MXroute does not permit all spam filtering to be disabled. SpamAssassin rejects messages scoring 25 or higher by default, and MXroute says it will re-enable filters if all filtering is disabled. [S26]
- **Default protection:** Expert Spam Filtering is enabled by default. It rejects unauthenticated mail at SMTP time from suspicious/residential/compromised network ranges. Authenticated MXroute outbound submission is unaffected. [S27]
- **Recommended:** Keep Expert Spam Filtering enabled. If a legitimate sender receives `Unauthenticated mail not allowed from this range`, request whitelisting first at `https://esf.mxroute.com`; temporary disabling is a last resort. [S27]
- **Restriction:** Expert Spam Filtering cannot be disabled while a domain has forwarders to Gmail/Google Workspace, Microsoft/Outlook/Office 365, Yahoo, AOL, or T-Online. [S27]
- **Spam-folder behavior changed:** In February 2026 MXroute removed the “deliver spam to spam folder” option from `panel.mxroute.com` because legacy handling could place forwarded mail in a hidden DirectAdmin/Linux-user mailbox. DirectAdmin may still show the unsafe legacy option. The 4.1 changelog lists configurable spam folder/threshold behavior as **in development**, not deployed as of this research date. [S14][S28]
- **Forwarding audit:** Review all forwarders, test needed routes, remove loops/stale destinations, and account for reputation and Expert Spam Filtering constraints. [S29]

### Migration and Required-Update Notices

#### Current Migration Guidance

MXroute does not migrate mail for customers. It recommends `imapsync`. The documented sequence is to create destination accounts, test a small mailbox, copy mail, verify results, update MX/SPF/DKIM/DMARC and clients, and keep the old service active for a transition period. Use the actual destination server hostname, not the generic `mail.mxroute.com` placeholder shown in the sample command. [S30]

#### Notices Relevant to Existing Accounts

| Date/version | Notice | Audit impact |
|---|---|---|
| 2025-06-18 / 3.2 | DNS ownership verification became mandatory for newly added domains; existing domains were exempt. | No retroactive TXT record is required merely because a domain already exists, but every newly added domain must be verified. [S10][S11] |
| 2025-12-18 / 3.9 | Unified `panel.mxroute.com` launched; new central CalDAV/CardDAV and broader Expert Spam Filtering controls. | Prefer the unified panel. CalDAV/CardDAV requires MX records to point to MXroute. [S31] |
| 2026-01-02 / 4.0 | `management.mxroute.com` and the new control panel became the primary UX; existing mail settings required no migration. | Audit old bookmarks/runbooks, but do not change working mail endpoints solely because of 4.0. [S19] |
| 2026-05-07 / 4.0.1 | Chocobo launched without DirectAdmin; panel quota display became authoritative; public MXroute API launched. | Do not design new tooling around DirectAdmin UI/login keys. Prefer panel API keys. [S18] |
| 2026-07-19 | MXroute gave advance notice of migration away from DirectAdmin, Crossbox, and Roundcube. | Identify dependencies on direct DA URLs, DA-only settings, Crossbox, and Roundcube. Plan alternatives; MXroute did not publish a universal cutoff date in this notice. [S13] |
| 4.1, living preview | In-house webmail is deployed; SMTP logs, AI spam filtering, self-service spam controls, and configurable spam folder/threshold remain in development. | Do not audit against unreleased functionality. Re-check the status tags before relying on a 4.1 feature. [S14] |

The July 2026 phaseout notice is advance notice, not a dated mandatory migration order. There was no current public notice requiring all existing domains to change MX/SPF/DKIM records or all users to migrate mailboxes by a fixed date. Server-specific incidents and maintenance should be checked at `status.mxroute.com`; the status page is operational state, not configuration documentation. [S13][S32]

## Documentation and Version Caveats

1. **Live 4.x docs take precedence over the archived `mxroute/mxdocs` repository.** The GitHub repository is explicitly archived, was last pushed June 9, 2025, and contains legacy DirectAdmin instructions and the obsolete 300/hour send limit. Current live docs and the June 2026 Terms say 400/hour. [S20][S22][S33]
2. **Server-specific values beat examples.** MX hostnames, relay hostnames, DKIM values, verification keys, quota behavior, and DirectAdmin availability vary by service/server. Use the control panel's displayed values.
3. **The 4.1 page is mutable.** Feature status can change without a new release page. This note records its state observed on 2026-08-22. [S14]
4. **Terms can change without notice.** The reviewed Terms are revision June 1, 2026 and expressly reserve amendment rights. Re-check them during future audits. [S8]
5. **Public documentation has internal inconsistencies.** Marketing/newsletter policy and DMARC-report language require conservative interpretation; contractual Terms and stricter current guidance should control pending written support clarification.
6. **Status is a snapshot.** The status page reported all systems operational when checked on 2026-08-22, but recent incident history included server, webmail/Crossbox, and outbound-delivery events. Use the current status/history during an actual incident. [S32]

## Suggested Evidence for a Read-Only Audit

Collect only non-secret evidence:

- Domain list and intended mail-routing owner.
- DNS query results for MX, SPF, `x._domainkey`, `_dmarc`, custom `mail`/`webmail` CNAMEs, and CAA where custom certificates are used.
- Control-panel DNS Tester pass/fail results without copying private credentials.
- Mail-client host, port, and TLS mode, with passwords redacted.
- Panel/API key inventory metadata, never key values.
- Mailbox and account quota/usage totals.
- Forwarder destinations, reviewed according to organizational data-handling rules.
- Spam-filter state and documented exceptions.
- Independent-backup owner, last successful run, and last restore test.
- Approved sending use cases and observed peak hourly counts.
- Dependencies on DirectAdmin, Crossbox, or Roundcube that need transition planning.

## Sources

All sources were accessed 2026-08-22 unless otherwise stated.

- **[S1]** MXroute, [Getting Started](https://docs.mxroute.com/docs/getting-started.html).
- **[S2]** MXroute, [Quick Setup Guide](https://docs.mxroute.com/docs/quick-setup.html).
- **[S3]** MXroute, [Managing Domains](https://docs.mxroute.com/docs/managing-domains.html).
- **[S4]** MXroute, [SPF Records](https://docs.mxroute.com/docs/spf-records.html).
- **[S5]** MXroute, [DKIM Configuration](https://docs.mxroute.com/docs/dns/dkim.html).
- **[S6]** MXroute Blog, [DKIM Signing Change / “Vulnerability” Exposure](https://blog.mxroute.com/dkim-signing-change-vulnerability-exposure), 2023-07-19.
- **[S7]** MXroute, [DMARC Records](https://docs.mxroute.com/docs/dns/dmarc.html).
- **[S8]** MXroute, [Terms of Service](https://mxroute.com/terms), revision 2026-06-01.
- **[S9]** MXroute Blog, [Buckle Up: Google and Yahoo Enforce DMARC](https://blog.mxroute.com/dmarc2024), 2024-02-15. Historical context; provider requirements may evolve.
- **[S10]** MXroute, [MXroute 3.2 Release](https://docs.mxroute.com/docs/changelog/mxroute-3.2.html), 2025-06-11.
- **[S11]** MXroute Blog, [New Domain Verification](https://blog.mxroute.com/domain-verification), 2025-06-18.
- **[S12]** MXroute, [Setting Up Custom Hostnames](https://docs.mxroute.com/docs/branding/customhostnames.html).
- **[S13]** MXroute Blog, [Ripping off bandages](https://blog.mxroute.com/ripping-off-bandages), 2026-07-19.
- **[S14]** MXroute, [MXroute 4.1 In Progress](https://docs.mxroute.com/docs/changelog/mxroute-4.1.html), living page.
- **[S15]** MXroute official archived docs, [SMTP/IMAP/POP details](https://github.com/mxroute/mxdocs/blob/master/LiveSite/content/general/smtpimappopdetails/_index.en.md). Archived; port details agree with current quick setup.
- **[S16]** MXroute, [Pre-Sales FAQ - Extended](https://docs.mxroute.com/docs/presales/faq-extended.html).
- **[S17]** MXroute, [Two-Factor Authentication and Email](https://docs.mxroute.com/docs/security/2fa.html).
- **[S18]** MXroute, [MXroute 4.0.1](https://docs.mxroute.com/docs/changelog/mxroute-4.0.1.html), 2026-05-07.
- **[S19]** MXroute, [MXroute 4.0 Release](https://docs.mxroute.com/docs/changelog/mxroute-4.0.html), 2026-01-02.
- **[S20]** MXroute official archived docs, [Login to DirectAdmin](https://github.com/mxroute/mxdocs/blob/master/LiveSite/content/directadmin/login/_index.en.md). Archived legacy guidance.
- **[S21]** MXroute, [Email Hosting API OpenAPI specification](https://api.mxroute.com/openapi.yaml), version `1.0.0` as served on research date.
- **[S22]** MXroute, [Service Limits](https://docs.mxroute.com/docs/presales/limits.html).
- **[S23]** MXroute, [Marketing Email Policy](https://docs.mxroute.com/docs/presales/marketing.html).
- **[S24]** MXroute, [Pre-Sales FAQ - Core](https://docs.mxroute.com/docs/presales/faq-core.html).
- **[S25]** MXroute Blog, [We Fixed Quota Reporting. Then Dovecot 2.4 Happened](https://blog.mxroute.com/we-fixed-quota-reporting-then-dovecot-2-4-happened), 2026-03-04.
- **[S26]** MXroute, [Can I disable all spam filters?](https://docs.mxroute.com/docs/presales/nospamfilter.html).
- **[S27]** MXroute, [Expert Spam Filtering](https://docs.mxroute.com/docs/expert-spam-filtering.html).
- **[S28]** MXroute Blog, [Why we removed the “deliver spam to spam folder” option](https://blog.mxroute.com/why-we-removed-the-deliver-spam-to-spam-folder-option-in-panel-mxroute-com), 2026-02-18.
- **[S29]** MXroute, [Email Forwarders](https://docs.mxroute.com/docs/email-forwarders.html).
- **[S30]** MXroute, [Migrating to MXroute](https://docs.mxroute.com/docs/migrate-to-mxroute.html).
- **[S31]** MXroute, [MXroute 3.9 Release](https://docs.mxroute.com/docs/changelog/mxroute-3.9.html), 2025-12-18.
- **[S32]** MXroute, [Status](https://status.mxroute.com/) and [Incident History](https://status.mxroute.com/history), snapshot 2026-08-22.
- **[S33]** MXroute, [`mxroute/mxdocs`](https://github.com/mxroute/mxdocs), official archived GitHub repository; repository metadata reported archived, last push 2025-06-09.
