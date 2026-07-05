# Anleitung: Deine Website selbst pflegen

Diese Website läuft komplett kostenlos: Der Code liegt auf **GitHub**,
gehostet wird über **GitHub Pages**, und bearbeiten kannst du alles über
**Pages CMS** im Browser — ohne Code anzufassen.

---

## 1. So bearbeitest du Inhalte (das Wichtigste!)

1. Gehe auf **https://app.pagescms.org** und melde dich **mit deinem GitHub-Account** an.
2. Wähle dein Website-Repository aus.
3. Links siehst du alle Bereiche:
   - **Startseite** — Kopfbereich (Showreel) und die Projekt-Abschnitte (Reihenfolge per Drag & Drop änderbar!)
   - **Menü & Einstellungen** — E-Mail-Adresse und die Menüpunkte in der Sidebar
   - **About-Seite**, **Impressum & Datenschutz**
   - **Projekt: …** — je ein Eintrag pro bestehender Projektseite (Say Wuff, LUZ, …)
   - **Neue Projekte** — hier legst du neue Projektseiten an
4. Ändern → **Save** klicken → die Änderung wird automatisch gespeichert und die
   Website baut sich neu. Nach **1–3 Minuten** ist die Änderung live.

**Textfelder:** Eine neue Zeile im Feld = Zeilenumbruch auf der Website.
`**fett**` oder `<strong>fett</strong>` macht Text fett.

**Bilder hochladen:** In jedem Bild-Feld kannst du über „Select" ein
vorhandenes Bild wählen oder ein neues hochladen. Bitte Bilder vorher auf
web-taugliche Größe verkleinern (unter ~2000 px Breite, JPG), sonst wird
die Seite langsam.

## 2. Ein neues Projekt anlegen (3 Schritte)

1. **„Neue Projekte" → Add Entry**: Titel eingeben, Überschrift ausfüllen
   (Titel + Info-Zeilen wie „Fiction • 2026 • 16mm"), dann die Seite aus
   **Bausteinen** zusammensetzen: Text, Foto-Galerie, Vimeo-Video,
   Video-Loop, Credits, Laurels — beliebig kombinierbar und sortierbar.
2. **Menü ergänzen**: Unter **Menü & Einstellungen** in der passenden Liste
   (Films oder Musicvideos) einen Eintrag hinzufügen. Bei „Projekt-Dateiname"
   den Dateinamen des neuen Projekts eintragen (steht in der URL des
   CMS-Eintrags, z. B. `mein-neuer-film`). Einträge ohne Dateinamen
   erscheinen grau (Platzhalter).
3. Optional: Auf der **Startseite** einen Abschnitt für das Projekt ergänzen.

**Vimeo-Videos:** Du brauchst nur die Video-ID — die Zahl aus der
Vimeo-URL (z. B. `vimeo.com/911480342` → ID `911480342`).

## 3. Erst-Einrichtung (einmalig, ca. 15 Minuten)

Falls noch nicht geschehen:

1. **GitHub:** Repository anlegen (Name: `DEINUSERNAME.github.io` für die
   kostenlose Haupt-Adresse) und diesen Ordner pushen:
   ```bash
   cd site
   git init && git add -A && git commit -m "Website"
   git branch -M main
   git remote add origin https://github.com/DEINUSERNAME/DEINUSERNAME.github.io.git
   git push -u origin main
   ```
2. **GitHub Pages aktivieren:** Im Repo → Settings → Pages →
   „Source: GitHub Actions". Der mitgelieferte Workflow
   (`.github/workflows/deploy.yml`) baut und veröffentlicht automatisch.
3. **Pages CMS verbinden:** Auf https://app.pagescms.org mit GitHub anmelden,
   das Repo auswählen, den Zugriff bestätigen. Fertig — die Konfiguration
   (`.pages.yml`) liegt schon im Repo.
4. **Eigene Domain (optional):** Repo → Settings → Pages → Custom domain.
   Beim Domain-Anbieter einen CNAME auf `DEINUSERNAME.github.io` setzen.

## 4. Schriften (wichtig zu wissen!)

Die Website nutzt **Myriad Pro / Acumin** über das Adobe-Fonts-Kit deines
Designers. Zwei Haken:

- Es hängt an **seinem** Adobe-Abo. Endet das Abo, laden die Schriften nicht mehr.
- Adobe erlaubt die Nutzung fremder Kits auf eigenen Seiten formal nicht.

**Absicherung ist eingebaut:** Fällt Adobe aus, springt automatisch die
sehr ähnliche, freie Schrift **Source Sans 3** ein (liegt mit im Projekt) —
die Seite bleibt ansehnlich statt kaputt. Langfristig empfehlenswert:
entweder eigenes Adobe-Abo (Kit selbst anlegen und in
`src/layouts/Base.astro` die Kit-URL tauschen) oder dauerhaft auf
Source Sans 3 wechseln.

## 5. Gefundene Original-Macken (Katalog)

Beim Nachbau 1:1 übernommen (außer wo vermerkt) — sag Bescheid, wenn ich
etwas davon fixen soll:

| # | Fund | Status |
|---|---|---|
| 1 | Browser-Titel der Startseite war „Copy of Fabian Podeszwa" | ✅ gefixt → „Fabian Podeszwa" |
| 2 | Mobil-Menü: „GOLF" führte ins Leere, „WOLFGANG PERÉZ" öffnete die Golf-Seite | ✅ gefixt (wie Desktop) |
| 3 | „Works"-Icon zeigt den Klick-Zustand nur auf Startseite, About und Say Wuff — nicht auf den anderen Projektseiten | übernommen |
| 4 | About: Button zeigt „studio@radicalchildren.com", öffnet aber Mail an fabianschuhsohle@gmail.com | übernommen (im CMS änderbar) |
| 5 | About: „Requests and licensing"-Button führt nirgendwohin | übernommen (im CMS änderbar) |
| 6 | Oracles, Golf (2 Videos) und Showreel-Seite laden Vimeo/Embedly OHNE Cookie-Einwilligung — Datenschutz-Lücke | übernommen (Verhalten identisch) |
| 7 | Datenschutzerklärung nennt noch Webflow + Cargo Collective als Hoster und Google Fonts | ⚠️ solltest du nach dem Umzug aktualisieren (neuer Hoster: GitHub Pages; Schriften: Adobe Fonts) |
| 8 | Menü-Platzhalter ohne Seiten: Roosevelt, Chuckamuck, Wolfgang Peréz, Andrew Collberg, the pollywogs, melt trio | übernommen |
| 9 | Schreibweisen wie „Junk Jornal", „Macualay culkin", „LOVESTORYSHOT" (fehlendes Leerzeichen) | übernommen (evtl. Absicht) |
| 10 | Die Seite `/works/showreel/` ist von nirgendwo verlinkt | übernommen |
| 11 | Videodateien mit Umlauten im Namen („Berg-Looüp…", „…für…") hätten auf dem neuen Hosting 404-Fehler erzeugt | ✅ umbenannt (ASCII) |
| 12 | Showreel + 2 Trailer lagen auf fabipoldi.github.io | ✅ ins Projekt geholt (self-contained) |
| 13 | Zwei Sidebar-Sticker-Bilder waren im Webflow-Export kaputt (Dateiname mit Leerzeichen, HTML erwartet Bindestriche) — der Export zeigte sie gar nicht | ✅ repariert, Sticker wieder sichtbar |
| 14 | Vimeo-Embeds auf Oracles/Golf (Embedly) liefern beim lokalen Testen 401 — auf der echten Domain laden sie normal | Hinweis |

## 6. Kleine Änderungen per Terminal (mit Claude)

Dieses Projekt liegt lokal unter
`~/Projekte/Website Fabian Podeszwa/site`. Öffne dort Claude Code und
beschreib einfach, was du ändern willst. Vorschau lokal:

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npm run dev     # → http://localhost:4321
```
