# fabianpodeszwa.com — Portfolio-Website

Portfolio von Fabian Podeszwa (Filmemacher). Ursprünglich in Webflow gebaut
(Design: [Nosedive Studio](https://nosedivestudio.com)), 2026 zu einem
statischen [Astro](https://astro.build)-Projekt migriert — pixelidentisch,
aber ohne Webflow-Abo und mit CMS-Anbindung.

## Stack

| Baustein | Lösung |
|---|---|
| Generator | Astro (statisch, kein Server nötig) |
| Inhalte | YAML-Dateien in `content/` |
| CMS | [Pages CMS](https://app.pagescms.org) — bearbeitet `content/` + `public/images` direkt via GitHub |
| Hosting | GitHub Pages (Workflow in `.github/workflows/deploy.yml`) |
| Design/Verhalten | Original-CSS + `webflow.js` aus dem Webflow-Export (unverändert) |

## Struktur

```
content/            Alle Inhalte (im CMS editierbar)
  home.yml            Startseite
  about.yml           About-Seite
  legal.yml           Impressum + Datenschutz
  settings.yml        E-Mail + Menüstruktur
  works/*.yml         Ein Projekt pro Datei
src/
  layouts/Base.astro  <head>, Fonts, Cookie-Consent, Scripts
  components/         Sidebar, Mobil-Menü, Bausteine
  components/works/   Layout je Projektseite (+ Generic für neue)
public/             CSS, JS, Bilder, Videos (1:1 aus dem Export)
.pages.yml          CMS-Konfiguration (Formulare/Felder)
scripts/visual-compare.mjs  Screenshot-Vergleich alt/neu (QA)
```

## Entwicklung

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # erzeugt dist/
```

Benötigt Node ≥ 22 (auf diesem Mac: `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"`).

Alle Details für Nicht-Techniker: siehe **ANLEITUNG.md**.
