import fs from 'node:fs';
import { chromium, devices } from 'playwright';

export const BASE = 'http://localhost:5173';
const SESSION_FILE = '/tmp/sommi-ls.json';

export async function openApp({ locale = 'en', video = null, camera = null } = {}) {
  const ls = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  ls.i18nextLng = locale;
  ls['sommelier-fab-intro-seen'] = 'true';
  ls.pwa_install_dismissed = String(Date.now());
  const args = camera
    ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${camera}`]
    : [];
  const browser = await chromium.launch({ args });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    deviceScaleFactor: 3,
    permissions: camera ? ['camera'] : [],
    locale: locale === 'he' ? 'he-IL' : 'en-US',
    ...(video ? { recordVideo: { dir: video, size: { width: 780, height: 1688 } } } : {}),
  });
  await context.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries)) {
      if (localStorage.getItem(k) === null || k === 'i18nextLng') localStorage.setItem(k, v);
    }
  }, ls);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      q.includes('display-mode: standalone')
        ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }
        : mm(q);
    const hide = () => {
      if (document.getElementById('__capture-css')) return;
      const s = document.createElement('style');
      s.id = '__capture-css';
      s.textContent = `button[aria-label*="dev" i], button[title*="dev" i] { display:none !important; }`;
      document.documentElement.appendChild(s);
    };
    document.addEventListener('DOMContentLoaded', hide);
    new MutationObserver(() => {
      document.querySelectorAll('button').forEach((b) => {
        if (b.textContent.trim() === '🔧') b.style.display = 'none';
      });
    }).observe(document, { childList: true, subtree: true });
  });
  await context.route(/\/rest\/v1\/profiles/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch();
    let body = await res.text();
    try {
      const json = JSON.parse(body);
      const patch = (p) => (p && typeof p === 'object' && 'preferred_language' in p ? { ...p, preferred_language: locale } : p);
      body = JSON.stringify(Array.isArray(json) ? json.map(patch) : patch(json));
    } catch {}
    await route.fulfill({ response: res, body });
  });
  const page = await context.newPage();
  return { browser, context, page };
}

export async function dismissOverlays(page) {
  for (const name of [/^close$/i, /not now/i, /later/i, /סגור/, /לא עכשיו/]) {
    const btn = page.getByRole('button', { name }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
}

export async function listControls(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, a[href], [role="button"], [role="tab"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        return `${el.tagName.toLowerCase()} [${Math.round(r.x)},${Math.round(r.y)}] ${label}${el.getAttribute('href') ? ' -> ' + el.getAttribute('href') : ''}`;
      }),
  );
}
