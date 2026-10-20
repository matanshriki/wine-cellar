import fs from 'node:fs';
import { openApp, dismissOverlays, listControls, BASE } from './lib.mjs';

const locale = process.argv[2] || 'en';
const prompt =
  locale === 'he' ? 'ארוחת סטייק הערב — איזה יין לפתוח מהמרתף?' : 'Steak dinner tonight — which bottle from my cellar should I open?';
const dir = `shots/${locale}-ask`;
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const { browser, page } = await openApp({ locale });
page.on('response', async (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) {
    console.log('NET', r.status(), r.url().replace(/^https?:\/\/[^/]+/, ''), (await r.text().catch(() => '')).slice(0, 300));
  }
});

await page.goto(BASE + '/agent', { waitUntil: 'load' });
await page.waitForTimeout(4000);
await dismissOverlays(page);
await page.screenshot({ path: `${dir}/a-open.png` });
const plusX = locale === 'he' ? 35 : 355;
await page.mouse.click(plusX, 44);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${dir}/b-new.png` });
console.log((await listControls(page)).filter((l) => !/\[-/.test(l)).slice(0, 40).join('\n'));
const input = page.locator('textarea, input[type="text"]').last();
await input.click();
await input.pressSequentially(prompt, { delay: 35 });
await page.screenshot({ path: `${dir}/c-typed.png` });
await input.press('Enter');
for (let i = 1; i <= 40; i++) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/d-${String(i).padStart(2, '0')}.png` });
}
await browser.close();
