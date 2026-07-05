import { getCollection, getEntry } from 'astro:content';

export interface NavItem {
  label: string;
  href: string | null;
  deactivated: boolean;
  current: boolean;
}

export interface Nav {
  films: NavItem[];
  musicvideos: NavItem[];
  email: string;
}

/**
 * Baut das Navigationsmodell aus settings.yml.
 * Einträge mit "work" verlinken auf die Projektseite; ohne "work" sind es
 * deaktivierte Platzhalter. currentSlug markiert den aktiven Menüpunkt.
 */
export async function getNav(currentSlug: string | null): Promise<Nav> {
  const settings = await getEntry('globals', 'settings');
  const works = await getCollection('works');
  const bySlug = new Map(works.map((w) => [w.id, w]));

  function resolve(items: any[]): NavItem[] {
    return (items ?? []).map((item) => {
      const work = item.work ? bySlug.get(item.work) : undefined;
      const href = work ? `/works/${item.work}/` : null;
      return {
        label: item.label,
        href,
        deactivated: item.deactivated === true || !work,
        current: !!item.work && item.work === currentSlug,
      };
    });
  }

  const nav = (settings?.data as any)?.nav ?? {};
  return {
    films: resolve(nav.films),
    musicvideos: resolve(nav.musicvideos),
    email: (settings?.data as any)?.email ?? '',
  };
}

/** CSS-Klassen für einen Sidebar-Button, exakt wie im Webflow-Export. */
export function navClass(item: NavItem): string {
  let cls = 'sidebar-button text-size';
  if (item.deactivated) cls += ' deactivated';
  cls += ' w-button';
  if (item.current) cls += ' w--current';
  return cls;
}
