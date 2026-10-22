#!/usr/bin/env node
/**
 * Reproducible authenticated screenshot coverage for sommi-design validation.
 *
 * Working directory: repository root (wine/). Paths below are relative to that root.
 * Do not `cd apps/web` and then pass `apps/web/scripts/...` — that doubles the prefix.
 *
 * Prerequisites:
 *   1. Dev server (from apps/web):
 *        cd apps/web && npx vite --host localhost --port 5173
 *   2. Auth storage JSON (SECRET — keep under /tmp, never commit):
 *        # From repo root, after the Vite server is up:
 *        node apps/web/scripts/sommi-a11y-auth-capture.mjs \
 *          --url http://localhost:5173/cellar \
 *          --out /tmp/sommi-private/storage.json
 *      Opens headed Chromium → sign in with Google → press Enter in the terminal.
 *      No manual localStorage dump.
 *   3. Playwright (once):
 *        cd /tmp && npm i --no-save playwright && npx playwright install chromium
 *      Or install in apps/web if preferred.
 *
 * Note: `.cursor/skills/sommi-design/` is gitignored. Prefer this script (tracked)
 * over the skill's shoot.mjs for authenticated coverage.
 *
 * Usage (from repository root):
 *   node apps/web/scripts/sommi-a11y-shoot.mjs \
 *     --url http://localhost:5173/cellar \
 *     --out /tmp/sommi-auth-shots \
 *     --storage /tmp/sommi-private/storage.json \
 *     [--langs en,he] [--themes white,red]
 *
 * Viewports (fixed for this validation pass):
 *   mob360, mob390, mob430, mobShort(390×640), desk1366, desk1440
 */

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1]]);
    return acc;
  }, []),
);

if (!args.url) {
  console.error('Missing --url');
  process.exit(1);
}
if (!args.storage) {
  console.error('Missing --storage (path to localStorage JSON; treat as secret)');
  process.exit(1);
}

const out = args.out ?? '/tmp/sommi-auth-shots';
const langs = (args.langs ?? 'en,he').split(',');
const themes = (args.themes ?? 'white,red').split(',');
const storage = JSON.parse(readFileSync(args.storage, 'utf8'));

const require = createRequire(join(__dirname, '../package.json'));
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = createRequire('/tmp/package.json')('playwright');
}
const { chromium } = playwright;

const VIEWPORTS = {
  desk1440: { width: 1440, height: 900 },
  desk1366: { width: 1366, height: 768 },
  mob390: { width: 390, height: 844, isMobile: true, hasTouch: true },
  mob360: { width: 360, height: 740, isMobile: true, hasTouch: true },
  mob430: { width: 430, height: 932, isMobile: true, hasTouch: true },
  mobShort: { width: 390, height: 640, isMobile: true, hasTouch: true },
};

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const report = { shoots: [], measures: {}, errors: [], notes: [] };

const ROUTES = (args.routes ?? 'cellar,recommendation,agent,history,wishlist,profile')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

for (const lang of langs) {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    for (const theme of themes) {
      const tag = `${lang}-${vpName}-${theme}`;
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: !!vp.isMobile,
        hasTouch: !!vp.hasTouch,
        locale: lang === 'he' ? 'he-IL' : 'en-US',
        reducedMotion: vpName === 'mobShort' ? 'reduce' : 'no-preference',
      });
      await ctx.addInitScript(
        ({ entries, lang, theme }) => {
          for (const [k, v] of Object.entries(entries)) {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          }
          localStorage.setItem('i18nextLng', lang);
          localStorage.setItem('theme', theme);
          localStorage.setItem('pwa_install_dismissed', '1');
          localStorage.setItem('sommelier-fab-intro-seen', '1');
        },
        { entries: storage, lang, theme },
      );
      // Prefer requested lang/theme over profile row for this shoot.
      await ctx.route('**/rest/v1/profiles*', async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const res = await route.fetch();
        let body = await res.text();
        try {
          const json = JSON.parse(body);
          const patch = (p) => ({
            ...p,
            preferred_language: lang,
            theme_preference: theme,
          });
          body = JSON.stringify(Array.isArray(json) ? json.map(patch) : patch(json));
        } catch {
          /* pass through */
        }
        await route.fulfill({ response: res, body });
      });

      const page = await ctx.newPage();
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));

      for (const route of ROUTES) {
        const path = route.startsWith('/') ? route : `/${route}`;
        const base = args.url.replace(/\/[^/]*$/, '') || 'http://localhost:5173';
        const target = args.url.includes(path) && ROUTES.length === 1
          ? args.url
          : `${base.replace(/\/$/, '')}${path}`;
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2500);
        if (page.url().includes('/login')) {
          report.notes.push(`${tag} ${path}: redirected to login (auth expired?)`);
          continue;
        }

        // Measure real interactive elements on cellar
        if (path.includes('cellar') && (vpName === 'desk1440' || vpName === 'mob390')) {
          const m = await page.evaluate(() => {
            const size = (el) => {
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { w: Math.round(r.width), h: Math.round(r.height), label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40) };
            };
            const chips = [...document.querySelectorAll('button.app-chip')].slice(0, 4).map(size);
            const nav = [...document.querySelectorAll('header a, nav a, nav button')].slice(0, 8).map(size);
            const titles = [...document.querySelectorAll('h3 button')].slice(0, 3).map(size);
            const dots = [...document.querySelectorAll('button.app-hit-target, [aria-label^="Go to"], [aria-label*="Show wine"]')].slice(0, 5).map(size);
            return { chips, nav, titles, dots };
          });
          report.measures[`${tag}-cellar`] = m;
        }

        // Drawer a11y probe on agent
        if (path.includes('agent')) {
          const closed = await page.evaluate(() => {
            const panel = document.getElementById('sommi-conversation-drawer');
            if (!panel) return { found: false };
            const style = getComputedStyle(panel);
            return {
              found: true,
              open: panel.classList.contains('open'),
              ariaHidden: panel.getAttribute('aria-hidden'),
              inert: panel.hasAttribute('inert'),
              role: panel.getAttribute('role'),
              ariaModal: panel.getAttribute('aria-modal'),
            };
          });
          report.notes.push(`${tag} drawer-closed: ${JSON.stringify(closed)}`);

          const hist = page.locator('button[aria-controls="sommi-conversation-drawer"]');
          if (await hist.count()) {
            await hist.click();
            await page.waitForTimeout(600);
            const openState = await page.evaluate(() => {
              const panel = document.getElementById('sommi-conversation-drawer');
              return {
                open: panel?.classList.contains('open'),
                ariaHidden: panel?.getAttribute('aria-hidden'),
                inert: panel?.hasAttribute('inert'),
                activeInDrawer: panel?.contains(document.activeElement),
              };
            });
            report.notes.push(`${tag} drawer-open: ${JSON.stringify(openState)}`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);
            const afterEsc = await page.evaluate(() => {
              const panel = document.getElementById('sommi-conversation-drawer');
              return {
                open: panel?.classList.contains('open'),
                inert: panel?.hasAttribute('inert'),
                activeLabel: document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName,
              };
            });
            report.notes.push(`${tag} drawer-escape: ${JSON.stringify(afterEsc)}`);
          }
        }

        const { h, vh } = await page.evaluate(() => {
          const s = document.body.scrollHeight > document.body.clientHeight ? document.body : document.scrollingElement;
          s.setAttribute('data-shoot-scroll', '1');
          return { h: s.scrollHeight, vh: s.clientHeight || window.innerHeight };
        });
        let i = 0;
        const maxFrames = vpName.startsWith('desk') ? 4 : 5;
        for (let y = 0; y < h && i < maxFrames; y += Math.max(vh * 0.85, 1)) {
          await page.evaluate((y) => document.querySelector('[data-shoot-scroll]')?.scrollTo(0, y), y);
          await page.waitForTimeout(500);
          const file = `${tag}-${route.replace(/\W+/g, '_')}-${String(i++).padStart(2, '0')}.png`;
          await page.screenshot({ path: join(out, file), fullPage: false });
          report.shoots.push(file);
        }
      }

      if (pageErrors.length) report.errors.push({ tag, pageErrors: pageErrors.slice(0, 5) });
      await ctx.close();
      console.log(tag, 'done');
    }
  }
}

writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log('Wrote', join(out, 'report.json'), 'frames:', report.shoots.length);
await browser.close();
