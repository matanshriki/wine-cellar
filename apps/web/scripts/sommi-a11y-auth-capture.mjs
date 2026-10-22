#!/usr/bin/env node
/**
 * Capture authenticated browser storage for sommi-a11y-shoot.mjs.
 *
 * Writes ONLY to a path you choose (default: /tmp/sommi-private/ — outside the repo).
 * Do NOT commit the output file. Add it to .gitignore if you ever store it under the repo.
 *
 * Working directory: repository root (or anywhere — paths below are absolute-friendly).
 *
 * Usage (repo root):
 *   node apps/web/scripts/sommi-a11y-auth-capture.mjs \
 *     --url http://localhost:5173/cellar \
 *     --out /tmp/sommi-private/storage.json
 *
 * Flow:
 *   1. Start the web app first:  cd apps/web && npx vite --host localhost --port 5173
 *   2. Run this script (headed Chromium opens).
 *   3. Sign in with Google in the opened window.
 *   4. When you land on an authenticated page, return here and press Enter.
 *   5. localStorage entries needed for session restore are written to --out.
 *
 * Requires: playwright (apps/web or /tmp). No manual localStorage dump.
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1]]);
    return acc;
  }, []),
);

const url = args.url ?? 'http://localhost:5173/cellar';
const out = args.out ?? '/tmp/sommi-private/storage.json';

const require = createRequire(join(__dirname, '../package.json'));
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = createRequire('/tmp/package.json')('playwright');
}
const { chromium } = playwright;

mkdirSync(dirname(out), { recursive: true });

console.log('Opening headed browser…');
console.log(`Navigate / sign in as needed: ${url}`);
console.log(`Storage will be written to: ${out}`);
console.log('(Keep this file private and untracked.)\n');

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });

const rl = createInterface({ input: process.stdin, output: process.stdout });
await new Promise((resolve) => {
  rl.question('After you are signed in on an authenticated page, press Enter here… ', () => {
    rl.close();
    resolve();
  });
});

const entries = await page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    // Supabase / auth session keys only — skip unrelated prefs.
    if (
      k.includes('supabase') ||
      k.includes('sb-') ||
      k.includes('auth') ||
      k === 'wine-cellar-auth' ||
      k === 'sommelier-fab-intro-seen'
    ) {
      out[k] = localStorage.getItem(k);
    }
  }
  return out;
});

const keys = Object.keys(entries);
if (keys.length === 0) {
  console.error('No auth-related localStorage keys found. Are you signed in?');
  await browser.close();
  process.exit(1);
}

writeFileSync(out, JSON.stringify(entries, null, 2), { mode: 0o600 });
console.log(`Wrote ${keys.length} keys → ${out}`);
await browser.close();
