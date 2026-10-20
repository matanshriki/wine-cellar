import fs from 'node:fs';
import { openApp, dismissOverlays, listControls, BASE } from './lib.mjs';

const locale = process.argv[2] || 'en';
const dir = `shots/${locale}-tonight`;
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const { browser, page } = await openApp({ locale });
page.on('response', async (r) => {
  if (r.url().includes('/functions/v1/') || r.url().includes('/api/')) {
    const body = r.status() >= 400 ? await r.text().catch(() => '') : '';
    console.log('NET', r.status(), r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80), body.slice(0, 300));
  }
});

await page.goto(BASE + '/recommendation', { waitUntil: 'load' });
await page.waitForTimeout(4000);
await dismissOverlays(page);
await page.screenshot({ path: `${dir}/a-start.png` });
await page.getByRole('button', { name: /Steak|סטייק/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Date Night|דייט|ערב רומנטי/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Something Special|משהו מיוחד/ }).first().click().catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${dir}/b-selected.png`, fullPage: true });
await page.getByRole('button', { name: /Get Recommendations|קבל|המלצ/ }).first().click();
for (let i = 1; i <= 45; i++) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/c-${String(i).padStart(2, '0')}.png` });
}
await page.screenshot({ path: `${dir}/d-result-full.png`, fullPage: true });
console.log('URL', page.url());
console.log((await listControls(page)).slice(0, 50).join('\n'));
await browser.close();
