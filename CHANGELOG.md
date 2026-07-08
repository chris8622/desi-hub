# Changelog

Alle nennenswerten Änderungen an Contentraum. Format nach
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/); Versionierung nach
[SemVer](https://semver.org/lang/de/). Formulierung kundentauglich — dieser Eintrag
wird später die „Was ist neu?"-Seite in der App.

Der technische Detailstand der SaaS-Migration liegt in `MIGRATION.md`.

## [Unreleased]

### Hinzugefügt
- **Admin-Konsole (Stufe 1)** — geschützte `/admin`-Seite mit eigenem Betreiber-Passwort
  (getrennt vom Kunden-Login). Module pro Instanz freischalten/sperren, Instanz-Status
  (Aktiv / Nur-Lese / Gesperrt), KI-Kill-Switch + Monatslimit, Ankündigungs-Banner,
  KI-Verbrauchs-Übersicht, Daten leeren und Backups einspielen (jeweils mit automatischem
  Undo-Snapshot), Audit-Log. Die Steuerung greift ohne Deploy (Remote-Flags in KV).
- **Release-Prozess** — CI-Gate (GitHub Action: Typecheck + Build), `dev`-Branch als
  Integrationszweig, Smoke- und Env-Var-Checklisten in `RELEASE.md`. Ab jetzt läuft jede
  Weiterentwicklung über diesen Weg; `main` bleibt immer lauffähig.

### Geändert
- Gesperrte Module verschwinden aus der Seitenleiste; ein Ankündigungs-/Status-Banner
  erscheint bei Bedarf über dem Inhalt.

## [0.1.0] — 2026-07-07

Basisstand vor Einführung der formalen Versionierung. Zusammengefasst aus der
SaaS-Härtung (Phasen 0, A-Sec, A2, B, C1–C4, Multi-KI).

### Hinzugefügt
- **Mehrere KI-Anbieter wählbar** — Groq, OpenAI, Gemini, Claude und Perplexity, mit
  Modell-Auswahl in den Einstellungen.
- **Post-Paket** — beim Einplanen bleiben Slides, Caption und Hashtags am Posttag erhalten.
- **„Heute fällig"-Cockpit** auf dem Dashboard mit Direkt-Kopier-Aktionen.
- **Hashtag-Bank im Erstell-Flow** — Sets einfügen und aus aktuellen Hashtags sichern.
- **Brand Voice** wirkt jetzt in allen KI-Generierungen (Ideen, Pinterest, Newsletter).
- **KI-Artikel im Editor** und **Research → Ideen-Pool** angebunden.
- **Pinterest-Verbindung** erneuert das Token automatisch vor Ablauf.

### Geändert
- KI läuft ausschließlich serverseitig; keine API-Keys mehr im Browser.
- Fonts self-hosted (keine externen Requests, DSGVO-konform).

### Sicherheit
- XSS im KI-Newsletter geschlossen (HTML-Sanitizing).
- Konstantzeit-Vergleich für Passwort/Token; kaputtes JSON → 400 statt 500.
- CSV-Export gegen Formel-Injection abgesichert.
- Security-Header + Content-Security-Policy gesetzt.
- Sync-Datenverlust behoben (Dirty-Flag, Flush-vor-Download, sichtbarer Fehlerstatus).
- Rate-Limiting für Login und KI-Routen; Payload- und Konflikt-Schutz beim Sync.

[Unreleased]: https://github.com/chris8622/desi-hub/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/chris8622/desi-hub/releases/tag/v0.1.0
