import * as fs from 'fs';
import { theme } from '../utils/theme';
import { isJsonMode, output } from '../utils/json-output';

export function diffCommand(file1: string, file2: string): void {
  if (!file1 || !file2) {
    console.log(theme.error('\n  Usage: mxroute diff <export1.json> <export2.json>\n'));
    return;
  }

  if (!fs.existsSync(file1)) {
    console.log(theme.error(`\n  File not found: ${file1}\n`));
    return;
  }
  if (!fs.existsSync(file2)) {
    console.log(theme.error(`\n  File not found: ${file2}\n`));
    return;
  }

  const data1 = JSON.parse(fs.readFileSync(file1, 'utf-8'));
  const data2 = JSON.parse(fs.readFileSync(file2, 'utf-8'));

  if (!isJsonMode()) {
    console.log(theme.heading(`Diff: ${data1.domain}`));
    console.log(theme.muted(`  ${file1} (${data1.exportedAt})`));
    console.log(theme.muted(`  ${file2} (${data2.exportedAt})\n`));
  }

  let changes = 0;

  // Compare accounts
  const accounts1 = new Set((data1.accounts || []).map((a: any) => a.user));
  const accounts2 = new Set((data2.accounts || []).map((a: any) => a.user));

  const addedAccounts = [...accounts2].filter((a) => !accounts1.has(a));
  const removedAccounts = [...accounts1].filter((a) => !accounts2.has(a));

  if (!isJsonMode() && (addedAccounts.length > 0 || removedAccounts.length > 0)) {
    console.log(theme.subheading('Accounts'));
    for (const a of addedAccounts) {
      console.log(theme.success(`    + ${a}@${data2.domain}`));
    }
    for (const a of removedAccounts) {
      console.log(theme.error(`    - ${a}@${data1.domain}`));
    }
    console.log('');
  }
  changes += addedAccounts.length + removedAccounts.length;

  // Compare forwarders
  const fwd1 = new Set((data1.forwarders || []).map((f: any) => `${f.user}→${f.destination}`));
  const fwd2 = new Set((data2.forwarders || []).map((f: any) => `${f.user}→${f.destination}`));

  const addedFwd = [...fwd2].filter((f) => !fwd1.has(f));
  const removedFwd = [...fwd1].filter((f) => !fwd2.has(f));

  if (!isJsonMode() && (addedFwd.length > 0 || removedFwd.length > 0)) {
    console.log(theme.subheading('Forwarders'));
    for (const f of addedFwd) {
      console.log(theme.success(`    + ${String(f).replace('→', ' → ')}`));
    }
    for (const f of removedFwd) {
      console.log(theme.error(`    - ${String(f).replace('→', ' → ')}`));
    }
    console.log('');
  }
  changes += addedFwd.length + removedFwd.length;

  // Compare autoresponders
  const ar1 = new Set((data1.autoresponders || []).map((a: any) => a.user));
  const ar2 = new Set((data2.autoresponders || []).map((a: any) => a.user));

  const addedAr = [...ar2].filter((a) => !ar1.has(a));
  const removedAr = [...ar1].filter((a) => !ar2.has(a));

  if (!isJsonMode() && (addedAr.length > 0 || removedAr.length > 0)) {
    console.log(theme.subheading('Autoresponders'));
    for (const a of addedAr) {
      console.log(theme.success(`    + ${a}`));
    }
    for (const a of removedAr) {
      console.log(theme.error(`    - ${a}`));
    }
    console.log('');
  }
  changes += addedAr.length + removedAr.length;

  // Catch-all
  const catchAllChanged = data1.catchAll !== data2.catchAll;
  if (!isJsonMode() && catchAllChanged) {
    console.log(theme.subheading('Catch-All'));
    console.log(theme.error(`    - ${data1.catchAll || '(none)'}`));
    console.log(theme.success(`    + ${data2.catchAll || '(none)'}`));
    console.log('');
  }
  if (catchAllChanged) changes++;

  if (isJsonMode()) {
    output('changes', changes);
    output('added', {
      accounts: addedAccounts,
      forwarders: addedFwd,
      autoresponders: addedAr,
      catchAll: catchAllChanged ? data2.catchAll : null,
    });
    output('removed', {
      accounts: removedAccounts,
      forwarders: removedFwd,
      autoresponders: removedAr,
      catchAll: catchAllChanged ? data1.catchAll : null,
    });
    return;
  }

  // Summary
  if (changes === 0) {
    console.log(theme.success(`  ${theme.statusIcon('pass')} No differences found.\n`));
  } else {
    console.log(theme.muted(`  ${changes} change${changes !== 1 ? 's' : ''} detected.\n`));
  }
}
