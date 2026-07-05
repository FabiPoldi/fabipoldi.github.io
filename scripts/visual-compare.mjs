// Screenshot-Vergleich: Original-Webflow-Export vs. Astro-Build
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] ?? 'shots';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['home', '/index.html', '/'],
  ['about', '/about.html', '/about/'],
  ['legal', '/legal.html', '/legal/'],
  ['say-wuff', '/works/say-wuff.html', '/works/say-wuff/'],
  ['junk-jornal', '/works/junk-jornal.html', '/works/junk-jornal/'],
  ['luz', '/works/luz.html', '/works/luz/'],
  ['milky-chance', '/works/milky-chance.html', '/works/milky-chance/'],
  ['oracals', '/works/oracals.html', '/works/oracals/'],
  ['golf', '/works/golf.html', '/works/golf/'],
  ['showreel', '/works/showreel.html', '/works/showreel/'],
];

const VIEWPORTS = [
  ['desktop', 1440, 900],
  ['tablet', 768, 1024],
  ['mobile', 390, 844],
];

const NEUTRALIZE_CSS = `
  video, iframe { visibility: hidden !important; }
  * { animation: none !important; transition: none !important; }
`;

const browser = await chromium.launch();

async function shoot(baseUrl, urlPath, file, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(baseUrl + urlPath, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.addStyleTag({ content: NEUTRALIZE_CSS });
  // Einmal komplett durchscrollen, damit lazy-Bilder laden
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = () => {
        y += 800;
        window.scrollTo(0, y);
        const h = Math.max(
          document.body?.scrollHeight ?? 0,
          document.documentElement?.scrollHeight ?? 0,
        );
        if (y < h) setTimeout(step, 60);
        else { window.scrollTo(0, 0); setTimeout(resolve, 400); }
      };
      step();
    });
  }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

const results = [];
for (const [name, origPath, newPath] of PAGES) {
  for (const [vp, w, h] of VIEWPORTS) {
    const fOrig = path.join(OUT, `${name}-${vp}-orig.png`);
    const fNew = path.join(OUT, `${name}-${vp}-neu.png`);
    await shoot('http://localhost:4600', origPath, fOrig, w, h);
    await shoot('http://localhost:4601', newPath, fNew, w, h);
    // Diff
    const a = PNG.sync.read(fs.readFileSync(fOrig));
    const b = PNG.sync.read(fs.readFileSync(fNew));
    const W = Math.max(a.width, b.width);
    const H = Math.max(a.height, b.height);
    const pad = (img) => {
      if (img.width === W && img.height === H) return img;
      const p = new PNG({ width: W, height: H });
      PNG.bitblt(img, p, 0, 0, img.width, img.height, 0, 0);
      return p;
    };
    const pa = pad(a), pb = pad(b);
    const diff = new PNG({ width: W, height: H });
    const bad = pixelmatch(pa.data, pb.data, diff.data, W, H, { threshold: 0.12 });
    const pct = ((bad / (W * H)) * 100).toFixed(2);
    fs.writeFileSync(path.join(OUT, `${name}-${vp}-diff.png`), PNG.sync.write(diff));
    const sizeNote = a.height !== b.height || a.width !== b.width ? ` [orig ${a.width}x${a.height} vs neu ${b.width}x${b.height}]` : '';
    results.push(`${name}-${vp}: ${pct}% (${bad}px)${sizeNote}`);
    console.log(results[results.length - 1]);
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'report.txt'), results.join('\n'));
