// Smoke-Test: lädt alle Seiten im echten Browser, sammelt Konsolen-Fehler
// und fehlgeschlagene Requests (404s), testet Mobil-Menü und Navigation.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4601';
const PAGES = ['/', '/about/', '/legal/', '/works/say-wuff/', '/works/junk-jornal/',
  '/works/luz/', '/works/milky-chance/', '/works/oracals/', '/works/golf/', '/works/showreel/'];

const browser = await chromium.launch();
let problems = 0;

for (const p of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('typekit')) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => errors.push(`goto: ${e.message.slice(0, 120)}`));
  await page.waitForTimeout(800);
  if (errors.length) {
    problems += errors.length;
    console.log(`✗ ${p}`);
    for (const e of [...new Set(errors)].slice(0, 8)) console.log(`   ${e}`);
  } else {
    console.log(`✓ ${p}`);
  }
  await page.close();
}

// Interaktionen auf der Startseite (mobil): Menü öffnen, Link klicken
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
const menuBtn = m.locator('.mobil-menu-button-div').first();
const subMenu = m.locator('.works-sub-menu.mobil').first();
const before = await subMenu.evaluate((el) => getComputedStyle(el).height);
await menuBtn.click();
await m.waitForTimeout(1200);
const after = await subMenu.evaluate((el) => getComputedStyle(el).height);
console.log(`Mobil-Menü: Höhe vorher=${before} nachher=${after} → ${before !== after ? 'ÖFFNET ✓' : 'KEINE REAKTION ✗'}`);
if (before === after) problems++;
const link = m.locator('.works-sub-menu.mobil a', { hasText: 'Say Wuff' }).first();
await link.click().catch(() => {});
await m.waitForTimeout(1000);
const url = m.url();
console.log(`Navigation nach Klick: ${url} → ${url.includes('/works/say-wuff') ? '✓' : '✗'}`);
if (!url.includes('/works/say-wuff')) problems++;

// Typekit-Fonts geladen?
const fontsOk = await m.evaluate(() => document.fonts.check('16px myriad-pro'));
console.log(`Font myriad-pro geladen: ${fontsOk ? '✓' : '✗ (Fallback aktiv?)'}`);

await browser.close();
console.log(problems ? `\n${problems} Problem(e) gefunden` : '\nAlles sauber ✓');
process.exit(0);
