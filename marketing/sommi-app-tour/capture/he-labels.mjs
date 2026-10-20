import path from 'node:path';
import { openApp, dismissOverlays, listControls, BASE } from './lib.mjs';

const { browser, page } = await openApp({ locale: 'he', camera: path.resolve('bottles/feed.y4m') });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/cellar', { waitUntil: 'load' });
await page.waitForTimeout(4500);
await dismissOverlays(page);
const cards = await page.evaluate(() =>
    [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).filter((l) => /פרטים|Amarone|אמרונה|אמרון/.test(l)).slice(0, 12),
);
console.log('CARDS', cards);
await page.getByRole('button', { name: /הוסף בקבוק/ }).last().click();
await page.waitForTimeout(2500);
console.log('CAMERA', (await listControls(page)).filter((l) => /\[\d+,[0-9]{1,3}\]/.test(l)).slice(-6));
await page.goto(BASE + '/agent', { waitUntil: 'load' });
await page.waitForTimeout(4500);
console.log('AGENT', (await listControls(page)).filter((l) => !/\[-/.test(l)).slice(0, 12));
await page.screenshot({ path: 'shots/he-agent.png' });
await browser.close();
