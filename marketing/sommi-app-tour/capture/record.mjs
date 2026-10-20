import fs from 'node:fs';
import path from 'node:path';
import { openApp, dismissOverlays, BASE } from './lib.mjs';
import { Recorder, markMainScroller } from './recorder.mjs';

const locale = process.argv[2] || 'en';
const only = process.argv[3]?.split(',');
const he = locale === 'he';
const FRAMES = path.resolve(`frames/${locale}`);
const CLIPS = path.resolve(`../assets/clips/${locale}`);
fs.mkdirSync(CLIPS, { recursive: true });

const L = {
  addBottle: he ? /הוסף בקבוק/ : /Add Bottle/,
  takePhoto: he ? /צלם|צילום|Take photo/ : /Take photo/,
  done: /^(Done|סיום|אישור|בוצע)$/,
  steakChip: he ? /ארוחת סטייק/ : /Steak dinner tonight/,
  getRecs: he ? /קבל המלצות/ : /Get Recommendations/,
};

async function session({ camera = false } = {}) {
  const s = await openApp({ locale, camera: camera ? path.resolve('bottles/feed.y4m') : null });
  await s.page.setViewportSize({ width: 390, height: 844 });
  await s.page.addStyleTag({ content: '' }).catch(() => {});
  return s;
}

async function go(page, route) {
  await page.goto(BASE + route, { waitUntil: 'load' });
  await page.waitForTimeout(4500);
  await dismissOverlays(page);
  await page.addStyleTag({
    content: `*{scroll-behavior:auto!important}
      button[aria-label="Open user menu"] img,button[aria-label="פתח תפריט משתמש"] img{opacity:0!important}
      button[aria-label="Open user menu"],button[aria-label="פתח תפריט משתמש"]{background:linear-gradient(145deg,#8b2741,#4a1722)!important}`,
  });
  await page.waitForTimeout(600);
}

const yOf = (page, locator) =>
  locator.evaluate((el) => {
    const sc = document.querySelector('[data-main-scroll="1"]') || document.scrollingElement;
    return el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
  });

const clips = {
  async cellar() {
    const { browser, page } = await session();
    await go(page, '/cellar');
    const r = new Recorder(page, FRAMES, 'cellar');
    await markMainScroller(page);
    await r.hold(1.2);
    const hold = page.getByRole('button', { name: he ? /שמור/ : /Hold/ }).first();
    await r.scroll((await yOf(page, hold)) - 330, 2.2);
    await r.hold(1.4);
    const ready = page.getByRole('button', { name: he ? /מוכן עכשיו/ : /Ready Now/ }).first();
    await r.tap(ready, { holdAfter: 1.4 });
    await r.hold(1.2);
    await markMainScroller(page);
    const firstCard = page.locator('[aria-label^="View details for"]').first();
    await r.scroll((await yOf(page, firstCard)) - 120, 1.6);
    await r.hold(1.4);
    r.encode(`${CLIPS}/cellar.mp4`);
    await browser.close();
  },

  async scan() {
    const { browser, page } = await session({ camera: true });
    await go(page, '/cellar');
    const r = new Recorder(page, FRAMES, 'scan');
    await r.hold(0.6);
    await r.tap(page.getByRole('button', { name: L.addBottle }).last(), { holdAfter: 1.4 });
    await r.hold(0.8);
    await r.tap(page.getByRole('button', { name: L.takePhoto }), { holdAfter: 1.0 });
    await r.hold(0.6);
    await r.tap(page.getByRole('button', { name: L.done }), {});
    await r.live(2.2);
    r.encode(`${CLIPS}/scan.mp4`);
    await browser.close();
  },

  async details() {
    const { browser, page } = await session();
    await go(page, '/cellar');
    const card = page.locator('[aria-label*="Amarone della Valpolicella"], [aria-label*="אמרונה דלה ולפוליצ"]').filter({ hasNotText: 'Classico' }).first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const r = new Recorder(page, FRAMES, 'details');
    await r.tap(card, { holdAfter: 1.6 });
    await r.hold(1.2);
    const scroller = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[role="dialog"] *, [role="dialog"]')];
      const el = els.find((e) => e.scrollHeight > e.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
      if (!el) return null;
      el.setAttribute('data-capture-scroll', '1');
      return el.scrollHeight - el.clientHeight;
    });
    if (scroller) {
      const sel = '[data-capture-scroll="1"]';
      await r.scroll(Math.min(scroller, 700), 2.4, sel);
      await r.hold(1.4);
      await r.scroll(Math.min(scroller, 1500), 2.2, sel);
      await r.hold(1.4);
    } else {
      await r.hold(3);
    }
    r.encode(`${CLIPS}/details.mp4`);
    await browser.close();
  },

  async tonight() {
    const { browser, page } = await session();
    await go(page, '/recommendation');
    const r = new Recorder(page, FRAMES, 'tonight');
    await r.hold(1.0);
    await r.tap(page.getByRole('button', { name: /🥩/ }).first(), { holdAfter: 0.3 });
    await r.tap(page.getByRole('button', { name: /💕/ }).first(), { holdAfter: 0.3 });
    await r.tap(page.getByRole('button', { name: /✨/ }).first(), { holdAfter: 0.3 });
    await r.tap(page.getByRole('button', { name: L.getRecs }).first(), {});
    await r.live(3.5);
    await r.hold(1.6);
    await r.scroll(420, 2.0);
    await r.hold(1.6);
    r.encode(`${CLIPS}/tonight.mp4`);
    await browser.close();
  },

  async ask() {
    const { browser, page } = await session();
    await go(page, '/agent');
    await page.mouse.click(he ? 35 : 355, 44);
    await page.waitForTimeout(1800);
    const r = new Recorder(page, FRAMES, 'ask');
    await r.hold(1.0);
    await r.tap(page.getByRole('button', { name: L.steakChip }).first(), {});
    await r.live(14, { speed: 2.2 });
    await page.waitForTimeout(2000);
    const sc = await page.evaluate(() => {
      const els = [...document.querySelectorAll('main *, div')];
      const el = els
        .filter((e) => e.scrollHeight > e.clientHeight + 100 && /(auto|scroll)/.test(getComputedStyle(e).overflowY))
        .sort((a, b) => b.clientHeight - a.clientHeight)[0];
      if (!el) return null;
      el.setAttribute('data-capture-scroll', '1');
      const bubbles = el.querySelectorAll('img');
      const last = bubbles[bubbles.length - 1];
      return { max: el.scrollHeight - el.clientHeight, cur: el.scrollTop };
    });
    if (sc) {
      await page.evaluate(() => (document.querySelector('[data-capture-scroll="1"]').scrollTop -= 520));
      await r.hold(0.4);
      await r.scroll(sc.max, 2.6, '[data-capture-scroll="1"]');
    }
    await r.hold(1.4);
    r.encode(`${CLIPS}/ask.mp4`);
    await browser.close();
  },

  async history() {
    const { browser, page } = await session();
    await go(page, '/history');
    const r = new Recorder(page, FRAMES, 'history');
    await r.hold(1.2);
    await r.scroll(520, 2.0);
    await r.hold(1.0);
    await r.tap(page.getByRole('link', { name: he ? /רשימת משאלות/ : /Wishlist/ }).first(), { holdAfter: 1.6 });
    await r.hold(1.4);
    r.encode(`${CLIPS}/history.mp4`);
    await browser.close();
  },
};

for (const [name, fn] of Object.entries(clips)) {
  if (only && !only.includes(name)) continue;
  try {
    await fn();
  } catch (e) {
    console.log(`!! ${name}: ${e.message.split('\n')[0]}`);
  }
}
