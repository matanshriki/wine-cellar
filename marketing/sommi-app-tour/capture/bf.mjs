import { chromium, devices } from 'playwright';
const b = await chromium.launch();
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['mobile', devices['iPhone 13']]]) {
  const c = await b.newContext({ ...opts, locale: 'he-IL' });
  const p = await c.newPage();
  await p.goto('https://www.bfriend.co.il/', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(4000);
  for (let y = 0; y < 12000; y += 600) { await p.evaluate(v => window.scrollTo(0, v), y); await p.waitForTimeout(150); }
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
  await p.screenshot({ path: `/tmp/bf-${name}.png`, fullPage: true });
  console.log(name, await p.evaluate(() => document.documentElement.scrollHeight));
  await c.close();
}
await b.close();
