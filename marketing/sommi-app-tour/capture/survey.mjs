import { openApp, dismissOverlays, listControls, BASE } from './lib.mjs';

const locale = process.argv[2] || 'en';
const only = process.argv[3];
const { browser, page } = await openApp({ locale });

async function go(path) {
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await dismissOverlays(page);
  await page.waitForTimeout(500);
}

async function shot(name, controls = false) {
  await page.screenshot({ path: `shots/${locale}-${name}.png` });
  console.log(`== ${name} ${page.url()}`);
  if (controls) console.log((await listControls(page)).slice(0, 60).join('\n'));
}

const steps = {
  async stats() {
    await go('/cellar');
    await page.getByRole('button', { name: /Ready Now|מוכן/ }).first().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(600);
    await shot('cellar-stats');
    await page.getByRole('button', { name: /Hold|להחזיק|המתנה/ }).first().click();
    await page.waitForTimeout(2000);
    await shot('drink-stats', true);
  },
  async details() {
    await go('/cellar');
    await page.getByRole('button', { name: /View bottle details|פרטי/ }).first().click();
    await page.waitForTimeout(2500);
    await shot('details', true);
  },
  async add() {
    await go('/cellar');
    await page.getByRole('button', { name: /Add Bottle|הוסף/ }).first().click();
    await page.waitForTimeout(1500);
    await shot('add', true);
  },
  async tonight() {
    await go('/recommendation');
    await shot('tonight', true);
  },
  async history() {
    await go('/history');
    await shot('history');
  },
  async wishlist() {
    await go('/wishlist');
    await shot('wishlist');
  },
  async ask() {
    await go('/cellar');
    await page.getByRole('button', { name: /Ask Sommi|שאל/ }).first().click();
    await page.waitForTimeout(2000);
    await shot('ask', true);
  },
  async plan() {
    await go('/cellar');
    await page.getByRole('button', { name: /Plan an evening|תכנן/ }).first().click();
    await page.waitForTimeout(2000);
    await shot('plan', true);
  },
};

for (const [name, fn] of Object.entries(steps)) {
  if (only && !only.split(',').includes(name)) continue;
  try {
    await fn();
  } catch (e) {
    console.log(`!! ${name} failed: ${e.message.split('\n')[0]}`);
  }
}
await browser.close();
