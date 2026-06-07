# Desi Hub — Design & Usability Audit
_Erstellt: 2026-06-07_

---

## Mobile Issues (je Seite)

### Alle Seiten (global)
- **[BEHOBEN]** Hamburger-Button wurde inline im Content-Flow gerendert → schob den Inhalt nach rechts und verursachte Overflow. Fix: `position: fixed; top: 1rem; left: 1rem; z-index: 60`.
- **[BEHOBEN]** `.main-content` hatte kein `padding-top` → h1-Heading kollidierte mit dem Hamburger. Fix: `padding: 4rem 1rem 2rem`.
- **[BEHOBEN]** Kein `overflow-x: hidden` auf `body` → horizontaler Scroll möglich.
- **[BEHOBEN]** `h1` mit 1.75rem auf Mobile zu groß. Fix: 1.4rem.
- Cards hatten 1.5rem padding auf Mobile → auf 1rem reduziert (in CSS).

### Dashboard (`app/page.tsx`)
- Stats-Grid ist hartkodiert als `repeat(4, 1fr)` mit inline style → bricht auf Mobile, `.grid-4` wird nicht durch die Media Query abgefangen (kein `.grid-4` CSS-Klasse definiert). **[KRITISCH]**
- Onboarding-Banner hat `display: flex` mit `gap: 1rem` aber kein `flex-wrap` → langer Text läuft am Button ab.
- Die "Schnellstart"-Grid nutzt ebenfalls `repeat(2, 1fr)` inline, aber die `.grid-2`-Klasse ist parallel definiert → die Media-Query greift nur auf `.grid-2`, nicht auf das inline-Grid.

### Planer (`app/planner/page.tsx`)
- Wochenkalender: `gridTemplateColumns: "repeat(7, 1fr)"` ohne Mobile-Fallback → 7 schmale Spalten, komplett unlesbar auf Phone. **[KRITISCH]**
- Navigationzeile (Vorherige/Heute/Nächste + Auto-Wochenplan + Legende) hat keine `flex-wrap` → läuft über auf kleinen Screens.
- Legende unten rechts hat keine Mobile-Behandlung → quetscht sich neben dem Monatsnamen.
- `+`-Button in jeder Tageszelle: 22×22px → unter der empfohlenen Touch-Target-Größe von 44px.

### Research (`app/research/page.tsx`)
- Suchzeile: `display: flex` ohne `flex-wrap` → Button "Recherchieren" wird auf schmalem Screen abgeschnitten.
- Action-Bar nach Ergebnissen: `repeat(auto-fill, minmax(180px, 1fr))` → funktioniert gut, kein Problem.
- Themen-Vorschläge sind wrappable → gut.

### Einstellungen (`app/settings/page.tsx`)
- Brand-Voice-Grid: `gridTemplateColumns: "1fr 1fr"` inline → bricht nicht auf Mobile um. **[MITTEL]**
- API-Key-Zeile (Input + "Key testen" Button): kein `flex-wrap` → Button wird auf kleinen Screens abgequetscht.
- Frequenz-Grid nutzt `.grid-3` Klasse (wird durch Media Query zu 1fr) → gut.

### Ideen-Pool (`app/ideen/page.tsx`)
- Ideen-Grid mit `minmax(290px, 1fr)` → auf 375px Breite entsteht horizontales Scrollen. Sollte auf 1fr fallen.
- Status-Select auf Ideen-Karte ist sehr klein und schwer tappbar.
- Aktions-Buttons auf Ideen-Karten: `flex: 1` + `btn-sm` → gut tappbar.

### Editor (`app/editor/page.tsx`)
- Zweigeteiltes Layout (Editor links, Preview rechts) — noch nicht geprüft, aber wahrscheinlich kritisch auf Mobile.

---

## Desktop-Usability-Issues

- **Fehlende Hover-States auf Cards**: Die Quick-Action-Cards haben `onMouseOver` inline, aber die Ideen-Karten und Research-Quellen-Karten haben keinen konsistenten Hover.
- **Planer-Tageszellen-Plus-Button**: 22×22px zu klein, auch auf Desktop schwer zu treffen.
- **Fehlende "Leerer Zustand"-Hinweise**: Research-Seite zeigt beim ersten Laden nichts außer der Suchbar — kein erklärender Text was das Tool kann.
- **Footer-Sync-Status**: `syncStatus === "idle"` zeigt gar nichts an — Nutzer weiß nicht ob Sync aktiv ist.
- **Settings-Seite**: Zweimal ein "Speichern"-Button (oben + unten) — das obere ist ein `btn-primary`, das untere ein voller Button. Konsistenz fehlt.

---

## Design-Konsistenz-Issues

### Border-Radius
- `var(--radius)` = 12px für Cards korrekt verwendet.
- `var(--radius-sm)` = 8px für Inputs, Buttons, Badges — größtenteils korrekt.
- Badges nutzen `border-radius: 999px` (pill) — konsistent.
- Planer-Tageszellen nutzen `var(--radius)` — korrekt.
- Manche inline Stile hardcoden `borderRadius: 8` statt `var(--radius-sm)` → sollte Variable sein.

### Font-Größen in ähnlichen Kontexten
- Section Labels: `.section-label` (0.7rem) vs `.label` (0.72rem) → nahe genug.
- Ideen-Karten nutzen 0.95rem für Titel, Research-Quellen-Karten 0.85rem → inkonsistent für vergleichbare Inhalte.
- Buttons: `.btn` = 0.875rem, `btn-sm` = 0.8rem — konsistent.
- Footer-Texte: 0.72rem — konsistent.

### Farb-Verwendung
- Accent-Farbe (terracotta) für primäre Aktionen → konsistent.
- Sage für Blog/sekundäres → konsistent.
- Gold für Newsletter/Warnung → konsistent.
- Warm-Red für Fehler/Löschen → konsistent.
- `var(--muted)` wird sowohl für deaktivierten Text als auch für Beschreibungen genutzt → kein Problem.

### Icon/Emoji-Konsistenz
- Alle Icons sind Emojis → konsistent.
- Manche Buttons haben Emojis im Label (z.B. "📦 Backup herunterladen"), andere nicht (z.B. "Speichern") → leichte Inkonsistenz, aber bewusste Entscheidung.

---

## Quick Wins (Fixes < 15 Minuten)

1. **Dashboard Stats-Grid auf Mobile fixen**: Inline-Style `gridTemplateColumns: "repeat(4, 1fr)"` → durch `.grid-4` CSS-Klasse ersetzen, die auf Mobile zu `1fr 1fr` kollabiert.
2. **Planer-Wochenansicht auf Mobile**: Auf Mobile zu einer vertikalen Listen-Ansicht (statt 7 Spalten) wechseln via Media Query.
3. **Planer `+`-Button vergrößern**: Von 22×22px auf min. 32×32px (besser 44×44px) anheben.
4. **Brand-Voice-Grid in Settings**: `gridTemplateColumns: "1fr 1fr"` → `.grid-2`-Klasse oder `flex-wrap: wrap`.
5. **Ideen-Grid mobile**: `minmax(290px, 1fr)` → `minmax(min(290px, 100%), 1fr)` oder Media Query.
6. **Research-Suchzeile**: `flex-wrap: wrap` + `button: width 100%` auf Mobile hinzufügen.
7. **Onboarding-Banner**: `flex-wrap: wrap` damit der Button auf Mobile in eine neue Zeile rutscht.
8. **API-Key-Zeile in Settings**: `flex-wrap: wrap; gap: 0.5rem` damit "Key testen" auf Mobile umbricht.
9. **Sidebar-Nav-Links auf Mobile**: Touch-Targets sind ~36px hoch (0.6rem padding oben/unten + 0.88rem Font) — auf ≥44px anheben.
10. **Leerer Zustand Research**: Wenn kein Query, kurzen Erklärungs-Teaser anzeigen ("Gib ein Thema ein um Quellen & KI-Zusammenfassungen zu erhalten").

---

## Was gut gemacht ist

1. **Farbsystem**: Erdtöne-Palette ist kohärent und warm — alle Farben harmonieren. CSS Custom Properties ermöglichen einfache Wartbarkeit.
2. **Sidebar-Overlay-Pattern**: Das Mobile-Drawer-Pattern mit Overlay-Backdrop ist korrekt implementiert (z-index gestaffelt, click-away schließt).
3. **Sync-Statusanzeige im Footer**: Cloud-Sync-Indikator mit visuell unterschiedlichen Zuständen (syncing/synced/local) ist durchdacht.
4. **Research Fact-Check**: Das mehrstufige Claim-Verifikations-UI mit Trust-Toggle auf Quellen ist UX-technisch sehr durchdacht und einzigartig.
5. **Ideen-Pool Quick-Add**: Enter-zum-Speichern + Tag-Auswahl erscheint nur wenn Text eingegeben wird → progressives Disclosure perfekt umgesetzt.

---

## Top 5 Fixes (nach Implementierung)

1. Dashboard Stats-Grid: `.grid-4` Klasse + Mobile 2-spaltig
2. Planer Wochenansicht: Mobile Listenansicht statt 7 Spalten  
3. Planer `+`-Button: Touch-Target-Größe auf 32×32px
4. Brand-Voice-Grid in Settings: flex-wrap
5. Ideen-Grid: minmax-Clamp fix
