import { openApp, dismissOverlays, listControls, BASE } from './lib.mjs';

const { browser, page } = await openApp({ locale: 'en' });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/cellar', { waitUntil: 'load' });
await page.waitForTimeout(4500);
await dismissOverlays(page);
const info = await page.evaluate(() => {
  const h = [...document.querySelectorAll('h1,h2,h3,h4,div,span')].find((e) => e.textContent.trim() === 'Drink Window');
  let card = h;
  for (let i = 0; i < 6 && card; i++) {
    card = card.parentElement;
    if (card.querySelector('button')) break;
  }
  const btns = [...card.querySelectorAll('button')].map((b) => ({
    label: b.getAttribute('aria-label') || b.textContent.trim().slice(0, 40),
    title: b.title,
  }));
  return btns;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
