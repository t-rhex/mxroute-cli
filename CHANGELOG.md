## [1.2.3](https://github.com/t-rhex/mxroute-cli/compare/v1.2.2...v1.2.3) (2026-03-16)

### Features

* per-domain credential overrides for DNS providers (providers.cloudflare:domain.com) ([4d4ea27](https://github.com/t-rhex/mxroute-cli/commit/4d4ea272f87e97c4b7c62a8178014d16faf4fa60))
## [1.2.2](https://github.com/t-rhex/mxroute-cli/compare/v1.2.1...v1.2.2) (2026-03-16)

### Features

* add activity log — tracks all write operations with mxroute log command ([9d0c2d7](https://github.com/t-rhex/mxroute-cli/commit/9d0c2d7903f4dc13065cfce5374c4f9ea21f161e))
* add self-update command (mxroute update) ([7d8534f](https://github.com/t-rhex/mxroute-cli/commit/7d8534f7982ac533f711b73ad0d9395f4e9d56ff))
* auto-backup snapshots before destructive operations ([f58c6f1](https://github.com/t-rhex/mxroute-cli/commit/f58c6f182fd051ac426467261afdd7bfaaf9e663))
* dns records shows live status (✔/✖/⚠) for each record ([4231223](https://github.com/t-rhex/mxroute-cli/commit/4231223cf32e138052ab753453e45c9d5c41f206))
* dns setup and onboard check existing records/accounts before creating ([ed3c9b4](https://github.com/t-rhex/mxroute-cli/commit/ed3c9b479cdbce2cfa0786c242f7744ef83f22a8))
* fix command asks per-action permission for destructive changes, validates DMARC rua address exists ([ad72d0e](https://github.com/t-rhex/mxroute-cli/commit/ad72d0ebefc3d5ffbb73b56773385875c300221b))

### Bug Fixes

* Cloudflare deleteRecord falls back to partial value match when exact match fails ([578852d](https://github.com/t-rhex/mxroute-cli/commit/578852d5e350740793027e4c274d9a39dcc08212))
## [1.2.1](https://github.com/t-rhex/mxroute-cli/compare/v1.2.0...v1.2.1) (2026-03-16)

### Bug Fixes

* dns records shows real DKIM key when DA API is configured ([f0a8fb4](https://github.com/t-rhex/mxroute-cli/commit/f0a8fb4015b53ed14b3582b08d28f4912cc81e5e))
## [1.2.0](https://github.com/t-rhex/mxroute-cli/compare/v1.1.3...v1.2.0) (2026-03-16)

### Features

* DNS provider routing (9 providers), sending account refactor, UX gap fixes ([8924e7c](https://github.com/t-rhex/mxroute-cli/commit/8924e7c772f1f01bd3bac8148dffac2e4954832d))
## [1.1.3](https://github.com/t-rhex/mxroute-cli/compare/v1.1.2...v1.1.3) (2026-03-16)

### Bug Fixes

* detect DNS authority before adding/deleting records ([92fe8f7](https://github.com/t-rhex/mxroute-cli/commit/92fe8f7eb81b72ff4334f4a9b88a6df5ab9101f2))
## [1.1.2](https://github.com/t-rhex/mxroute-cli/compare/v1.1.1...v1.1.2) (2026-03-16)

### Bug Fixes

* pin React 17 to match ink v3 peer dependency (removes npm warnings) ([baffab9](https://github.com/t-rhex/mxroute-cli/commit/baffab9b9338dea4cf2c85ff8f666ba224d6b6a0))
## [1.1.1](https://github.com/t-rhex/mxroute-cli/compare/v1.1.0...v1.1.1) (2026-03-16)

### Bug Fixes

* **dashboard:** wrap all strings in Text components for Ink v3 compatibility ([ce73d68](https://github.com/t-rhex/mxroute-cli/commit/ce73d68a50eb47f0dcd3925577dd26e627602150))
## [1.1.0](https://github.com/t-rhex/mxroute-cli/compare/v1.0.3...v1.1.0) (2026-03-16)

### Features

* platform mode — json, guide, suggest, playbook, dashboard ([10f8270](https://github.com/t-rhex/mxroute-cli/commit/10f8270d7a740b7050f3293e56af0beb2d66eb98))
## [0.3.2](https://github.com/t-rhex/mxroute-cli/compare/v0.3.1...v0.3.2) (2026-03-15)

### Bug Fixes

* setup wizard no longer auto-selects all detected tools ([2a5d854](https://github.com/t-rhex/mxroute-cli/commit/2a5d8540f8b631ede7683f0966c5493fbd6c0f3c))
## [0.3.1](https://github.com/t-rhex/mxroute-cli/compare/v0.3.0...v0.3.1) (2026-03-15)

### Bug Fixes

* setup wizard skips already-configured steps ([a171cd8](https://github.com/t-rhex/mxroute-cli/commit/a171cd82094defed634d60f53ba532cb1811c4b8))
## [0.3.0](https://github.com/t-rhex/mxroute-cli/compare/v0.2.0...v0.3.0) (2026-03-14)

### Features

* add agentic commands — fix, onboard, report, header-analyze, migrate, notify ([bfcb35b](https://github.com/t-rhex/mxroute-cli/commit/bfcb35b45674457c346d832c09302771bc16c128))
## [0.2.0](https://github.com/t-rhex/mxroute-cli/compare/v0.1.3...v0.2.0) (2026-03-14)

### Features

* add audit, IP blacklist check, share, and monitor commands ([c234bf7](https://github.com/t-rhex/mxroute-cli/commit/c234bf7a4c25901363e67e8d6ab7f034b908929e))
* add dns setup, doctor, export/import, whoami, open commands ([d0df9f0](https://github.com/t-rhex/mxroute-cli/commit/d0df9f0860ba62623b19b4e11efe002442f45af7))
* add webhook, completions, dns watch, bulk, diff, benchmark, cron ([31e9f24](https://github.com/t-rhex/mxroute-cli/commit/31e9f24608285ef1a338c11a03ddb60fe7ad231c))

### Bug Fixes

* comprehensive review — bugs, UX, and code quality fixes ([f626dca](https://github.com/t-rhex/mxroute-cli/commit/f626dca6e2e96425f5dae08080d31ebe1b352c03))
## [0.1.3](https://github.com/t-rhex/mxroute-cli/compare/v0.1.2...v0.1.3) (2026-03-14)

### Features

* improved status dashboard — show API auth status, guide users ([26e810d](https://github.com/t-rhex/mxroute-cli/commit/26e810ddee65bfaec554ee0b1ac3c893cd02fc6b))
## [0.1.2](https://github.com/t-rhex/mxroute-cli/compare/v0.1.1...v0.1.2) (2026-03-14)

### Features

* unified config setup — API key first, SMTP optional ([b4de281](https://github.com/t-rhex/mxroute-cli/commit/b4de28170357bd174979c05dcb04dfc236e53c16))
## 0.1.1 (2026-03-14)

### Features

* initial release v0.1.0 — MXroute CLI + MCP server ([03c38f7](https://github.com/t-rhex/mxroute-cli/commit/03c38f718439b029e13c103b873eb0d87fb0d877))

### Bug Fixes

* **ci:** drop Node 18 from matrix — vitest v4 requires Node 20+ ([75b2980](https://github.com/t-rhex/mxroute-cli/commit/75b298000d7161fd4d16990d95fd6c77067a2dab))
## 0.1.0 (2026-03-14)

### Features

* initial release v0.1.0 — MXroute CLI + MCP server ([03c38f7](https://github.com/t-rhex/mxroute-cli/commit/03c38f718439b029e13c103b873eb0d87fb0d877))

### Bug Fixes

* **ci:** drop Node 18 from matrix — vitest v4 requires Node 20+ ([75b2980](https://github.com/t-rhex/mxroute-cli/commit/75b298000d7161fd4d16990d95fd6c77067a2dab))
