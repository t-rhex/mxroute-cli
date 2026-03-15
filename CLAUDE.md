# CLAUDE.md - Project Conventions

## Project Overview
mxroute-cli — CLI and MCP server for managing MXroute email hosting (DirectAdmin API, IMAP, SMTP). Node.js >= 20, TypeScript, MIT license.

## Build & Test Commands
- `npm run build` — compile TypeScript (tsc, outputs to dist/)
- `npx vitest run` — run all tests
- `npx vitest run tests/specific.test.ts` — run a single test file
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` / `npm run format:check` — Prettier
- `npm run typecheck` — tsc --noEmit
- `npm run ci` — lint + typecheck + build + test (full check)

## Architecture
- `src/index.ts` — CLI entry point (commander)
- `src/mcp.ts` — MCP server entry point
- `src/commands/` — CLI command implementations
- `src/utils/` — shared utilities (imap, mime, dns, smtp, config)
- `dist/` — compiled output (CommonJS, ES2020 target)

## Code Style
- TypeScript strict mode enabled
- **Semicolons** at end of statements
- Single quotes for strings
- Functional style preferred; async/await for all I/O
- Prettier and ESLint enforced via husky pre-commit hooks (lint-staged)

## Testing
- Framework: vitest (tests in `tests/` directory)
- Tests import from `dist/` — **build before running tests**
- Coverage targets `dist/utils/` only (v8 provider); commands are tested for exports/schema, not interactive flows
- Some tests require network access and will timeout in sandboxed environments: dns, blacklist, api, directadmin
- Test timeout: 10 seconds
- MCP tests validate tool registration, schemas, and parameter shapes (not live execution)

## Key Conventions
- Zero external runtime deps for core utilities (raw tls, dns, net modules)
- chalk for CLI output, commander for arg parsing, inquirer for prompts
- zod for MCP schema validation, @modelcontextprotocol/sdk for MCP server
- Profiles stored in `~/.config/mxroute-cli/config.json`
- Two binaries: `mxroute` (CLI) and `mxroute-mcp` (MCP server)
