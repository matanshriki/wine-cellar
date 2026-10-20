import path from 'node:path';
import { openApp, dismissOverlays, listControls, BASE } from './lib.mjs';

const locale = process.argv[2] || 'en';
const camera = path.resolve('bottles/feed.y4m');
const { browser, page } = await openApp({ locale, camera });
await page.goto(BASE + '/cellar', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await dismissOverlays(page);
await page.getByRole('button', { name: /Add Bottle|הוספ|הוסף/ }).last().click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `shots/${locale}-camera.png` });
console.log((await listControls(page)).join('\n'));
await browser.close();
