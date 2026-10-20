import fs from 'node:fs';
import path from 'node:path';
import { openApp, dismissOverlays, listControls, BASE } from './lib.mjs';

const locale = process.argv[2] || 'en';
const camera = path.resolve('bottles/feed.y4m');
const dir = `shots/${locale}-scan`;
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const { browser, page } = await openApp({ locale, camera });
page.on('response', async (r) => {
  if (r.status() >= 400) console.log('HTTP', r.status(), r.request().method(), r.url().slice(0, 140));
  if (r.url().includes('/functions/v1/')) {
    const body = await r.text().catch(() => '');
    console.log('FN', r.status(), r.url().split('/functions/v1/')[1], body.slice(0, 600));
  }
});
page.on('requestfailed', (r) => console.log('FAILED', r.url().slice(0, 140), r.failure()?.errorText));
page.on('console', (m) => {
  if (m.type() === 'error' || /scan|label/i.test(m.text())) console.log('CONSOLE', m.type(), m.text().slice(0, 300));
});
await page.goto(BASE + '/cellar', { waitUntil: 'load' });
await page.waitForTimeout(4000);
await dismissOverlays(page);
await page.getByRole('button', { name: /Add Bottle|הוספ|הוסף/ }).last().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${dir}/a-camera.png` });
await page.getByRole('button', { name: /Take photo|צלם/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${dir}/b-crop.png` });
await page.getByRole('button', { name: /^Done$|^סיום$|^אישור$/ }).click();
for (let i = 1; i <= 40; i++) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/c-${String(i).padStart(2, '0')}.png` });
}
const controls = await listControls(page);
console.log(controls.filter((l) => !/\[\d+,(1\d{3}|\d{4,})\]/.test(l)).join('\n'));
await page.screenshot({ path: `${dir}/d-final-full.png`, fullPage: true });
await browser.close();
