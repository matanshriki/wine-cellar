import fs from 'node:fs';
import { openApp, dismissOverlays, BASE } from './lib.mjs';

const { browser, page } = await openApp({ locale: 'en' });
await page.goto(BASE + '/cellar', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await dismissOverlays(page);
const imgs = await page.evaluate(() =>
  [...document.querySelectorAll('img')]
    .map((i) => ({ src: i.currentSrc || i.src, alt: i.alt, w: i.naturalWidth, h: i.naturalHeight }))
    .filter((i) => i.w > 200 && i.h > 300),
);
console.log(JSON.stringify(imgs.slice(0, 12), null, 1));
fs.mkdirSync('bottles', { recursive: true });
let n = 0;
for (const img of imgs.slice(0, 8)) {
  const res = await page.request.get(img.src).catch(() => null);
  if (!res || !res.ok()) continue;
  fs.writeFileSync(`bottles/b${n++}.jpg`, await res.body());
}
console.log('saved', n);
await browser.close();
