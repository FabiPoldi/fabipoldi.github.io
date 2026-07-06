import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';

// Leitet srcset/sizes im Webflow-Format aus den vorhandenen
// Responsive-Varianten (-p-500, -p-800, …) in public/ ab.
// Bilder ohne Varianten bekommen kein srcset (wie im Original).

const cache = new Map<string, { srcset?: string; sizes?: string; width?: number; height?: number }>();

export function responsive(src: string): { srcset?: string; sizes?: string; width?: number; height?: number } {
  if (cache.has(src)) return cache.get(src)!;
  const result = compute(src);
  cache.set(src, result);
  return result;
}

function compute(src: string): { srcset?: string; sizes?: string; width?: number; height?: number } {
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
    const size = imageSize(fs.readFileSync(abs));
    const dims = size.width && size.height ? { width: size.width, height: size.height } : {};
    if (widths.length === 0 || !size.width) return dims;
    const parts = widths
      .filter((w) => w < size.width!)
      .map((w) => `${stem}-p-${w}${ext} ${w}w`);
    parts.push(`${src} ${size.width}w`);
    return {
      ...dims,
      srcset: parts.join(', '),
      sizes: `(max-width: ${size.width}px) 100vw, ${size.width}px`,
    };
  } catch {
    return {};
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
