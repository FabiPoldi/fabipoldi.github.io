import { Marked } from 'marked';

const marked = new Marked({ breaks: true, gfm: true });

// GFM-Autolinking abschalten: nackte URLs/E-Mails im Text sollen
// (wie im Webflow-Original) reiner Text bleiben, keine Links werden.
marked.use({
  tokenizer: {
    url() {
      return undefined;
    },
  } as any,
});

/**
 * Rendert einen Markdown-Text als Inline-HTML (ohne <p>-Wrapper).
 * Zeilenumbrüche werden zu <br>, **fett** zu <strong>, *kursiv* zu <em>.
 */
export function inline(md?: string | null): string {
  if (!md) return '';
  return marked.parseInline(md) as string;
}

/** Rendert Markdown als Block-HTML (mit <p>-Wrappern). */
export function block(md?: string | null): string {
  if (!md) return '';
  return marked.parse(md) as string;
}
