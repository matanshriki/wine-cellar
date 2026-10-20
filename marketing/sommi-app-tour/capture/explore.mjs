import { openApp, dismissOverlays, listControls, BASE } from './lib.mjs';

const path = process.argv[2] || '/cellar';
const out = process.argv[3] || 'shots/explore.png';
const locale = process.argv[4] || 'en';
const fullPage = process.argv.includes('--full');

const { browser, page } = await openApp({ locale });
await page.goto(BASE + path, { waitUntil: 'load' });
await page.waitForTimeout(2500);
await dismissOverlays(page);
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage });
console.log('URL', page.url());
console.log((await listControls(page)).join('\n'));
await browser.close();
