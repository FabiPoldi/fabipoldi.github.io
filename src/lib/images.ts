import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';

// Leitet srcset/sizes im Webflow-Format aus den vorhandenen
// Responsive-Varianten (-p-500, -p-800, …) in public/ ab.
// Bilder ohne Varianten bekommen kein srcset (wie im Original).

const cache = new Map<string, { srcset?: string; sizes?: string }>();

export function responsive(src: string): { srcset?: string; sizes?: string } {
  if (cache.has(src)) return cache.get(src)!;
  const result = compute(src);
  cache.set(src, result);
  return result;
}

function compute(src: string): { srcset?: string; sizes?: string } {
  try {
    const abs = path.join(process.cwd(), 'public', decodeURI(src));
    if (!fs.existsSync(abs)) return {};
    const ext = path.extname(src);
    const stem = src.slice(0, src.length - ext.length);
    const baseName = path.basename(stem);
    const dir = path.dirname(abs);
    // Varianten wie "Name-p-500.jpg"; Thumbnails ("-p-130x130q80") fallen raus,
    // weil nach den Ziffern direkt die Dateiendung folgen muss.
    const re = new RegExp(`^${escapeRegex(baseName)}-p-(\\d+)${escapeRegex(ext)}$`);
    const widths = fs
      .readdirSync(dir)
      .map((f) => f.match(re))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => parseInt(m[1], 10))
      .sort((a, b) => a - b);
    if (widths.length === 0) return {};
    const originalWidth = imageSize(fs.readFileSync(abs)).width;
    if (!originalWidth) return {};
    const parts = widths
      .filter((w) => w < originalWidth)
      .map((w) => `${stem}-p-${w}${ext} ${w}w`);
    parts.push(`${src} ${originalWidth}w`);
    return {
      srcset: parts.join(', '),
      sizes: `(max-width: ${originalWidth}px) 100vw, ${originalWidth}px`,
    };
  } catch {
    return {};
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
