// Thin wrapper that lazy-loads the Ink/React dashboard.
// The actual dashboard is in dashboard-app.tsx and compiled separately
// via tsconfig.dashboard.json to avoid requiring --jsx in the main build.

export async function dashboardCommand(): Promise<void> {
  // Use require() to avoid TypeScript resolving the .tsx file at compile time.
  // The .tsx file is compiled separately by tsconfig.dashboard.json.

  const mod = require('./dashboard-app') as { dashboardCommand: () => Promise<void> };
  await mod.dashboardCommand();
}
