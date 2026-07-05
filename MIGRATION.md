# Migration: Desi Hub → „Creator Hub" SaaS

Fortschritts- und Übergabedokument für den Umbau vom Einzelkunden-Tool zum
mandantenfähigen Produkt. Phasenplan siehe `desi-hub-umsetzungsprompt-opus.md`
(auf dem Desktop). **Regel: Desi bleibt in jeder Phase voll arbeitsfähig.**

---

## Status

| Phase | Titel | Status |
|-------|-------|--------|
| 0 | Sicherheits-Härtung des Bestands | ✅ **abgeschlossen** (2026-07-05) |
| 1 | Postgres + echte Logins | ⏳ offen |
| 2 | Entitlements + Admin-Cockpit | ⏳ offen |
| 3 | Theming + Rechtliches | ⏳ offen |
| 4 | Publishing + Analytics | ⏳ offen |
| 5 | Stripe + Ausbau | ⏳ offen (nur Interface vorbereiten) |

---

## Phase 0 — abgeschlossen

**0.1 Rate-Limiting** — `lib/ratelimit.ts` (neu). `@upstash/ratelimit` + `@upstash/redis`.
- Login (`/api/auth`): 5 Versuche / IP / 15 min → 429 mit `Retry-After`.
- KI-Routen (`generate`, `research`, `trends`, `autoplan`, `repurpose`): 30 / IP / Stunde → 429.
- **Fail-open:** Ohne Upstash-Env (lokal) werden Anfragen durchgelassen — Rate-Limiting darf App/Login nie blockieren. Auf Vercel aktiv, weil `KV_REST_API_URL`/`KV_REST_API_TOKEN` gesetzt sind.

**0.2 Client-API-Keys abgeschafft** — Server nutzt ausschließlich `process.env`.
- Alle KI-Routen ignorieren jetzt client-übergebene `groqKey`/`perplexityKey`.
- Settings: Groq- und Perplexity-Key-Felder + `TestKeyButton` entfernt; Hinweis „KI ist serverseitig konfiguriert".
- Client-Seiten (dashboard, research, content, email, planner, trends, hashtags, repurpose) senden keine Keys mehr und haben ihre „Kein Key"-Sperren/Banner verloren (KI ist immer verfügbar, der Server entscheidet).
- Migration in `LoginGate.tsx`: löscht `groq_key`/`perplexity_key` aus `dh_settings` im Browser beim App-Start. **Runtime verifiziert:** Keys werden gestrippt, übrige Settings bleiben.
- **Perplexity-Research-Engine** ist vorerst aus der UI entfernt (kein Client-Signal mehr, ob serverseitig ein Key existiert). Wieder aktivierbar, sobald `PERPLEXITY_API_KEY` gesetzt ist + ein Status-Endpoint die Verfügbarkeit meldet (passt gut in Phase 2 / Entitlements). Die Route unterstützt `engine: "perplexity"` weiterhin, falls der Env-Key vorhanden ist.

**0.3 Sync-Datenverlust-Schutz** — `app/api/sync/route.ts` + `lib/sync.ts`.
- Payload-Limit 2 MB → 413.
- KV speichert jetzt Wrapper `{ updatedAt, data }` (abwärtskompatibel mit altem Roh-Format).
- Konflikt-Schutz: Client sendet `x-last-synced-at`; ist der Server-Stand neuer → 409. Client lädt dann den Server-Stand (`syncDown`), setzt `sessionStorage.desi_sync_conflict` und lädt neu; `LoginGate` zeigt einmalig den Hinweis „Daten wurden von einem anderen Gerät aktualisiert und neu geladen."
- Tages-Backups: `desi_hub_backup_<YYYY-MM-DD>` + Index `desi_hub_backup_index`, Aufbewahrung 14 Tage (ältere werden beim Write gelöscht). **Wiederherstellung** vorerst manuell über die Upstash-Konsole (Backup-Key nach `desi_hub_data_v1` kopieren).

**0.4 DSGVO / ipapi.co entfernt** — `app/api/auth/route.ts` nutzt jetzt die Vercel-Header
`x-vercel-ip-city` / `x-vercel-ip-country` statt eines externen Calls mit Besucher-IPs. **Runtime verifiziert:** kein ipapi.co-Call mehr im Code.

**0.5 Vision-Board Speicher** — `app/vision/page.tsx`.
- Upload wird clientseitig per Canvas auf max. 1280 px verkleinert und als JPEG (0.8, Fallback 0.6) komprimiert; hartes Limit 300 KB, sonst freundliche Ablehnung.
- `saveBoard` wertet den `setLS`-Rückgabewert aus und warnt bei vollem Speicher.
- **Runtime verifiziert:** 3648 KB PNG → 48 KB JPEG, unter Limit.

### Was in Phase 0 NICHT lokal testbar war (aktiv auf Vercel)
Rate-Limit (429), Payload-Limit (413) und Sync-Konflikt (409) benötigen Upstash/KV.
Lokal ist KV nicht konfiguriert (`getUpstashConfig()` → null), daher greifen diese
Pfade erst in Produktion. Code kompiliert, Build grün, Logik per Review geprüft.

---

## Env-Vars

```
# aktiv (lokal + Vercel)
APP_PASSWORD=            # Login-Passwort (Phase 1 wird es durch echte Accounts ersetzt)
GROQ_API_KEY=            # KI (jetzt NUR serverseitig)
SERPER_API_KEY=          # Web-Suche (Research/Trends)

# nur Vercel (lokal nicht gesetzt → KV-Features fallen sauber aus)
KV_REST_API_URL=         # Upstash — Rate-Limiting, Sync, Backups
KV_REST_API_TOKEN=

# optional
PERPLEXITY_API_KEY=      # Premium-Research (UI-Toggle erst wieder mit Status-Endpoint, s. 0.2)
PINTEREST_APP_ID= / PINTEREST_APP_SECRET= / PINTEREST_CALLBACK_URL=
```

### [AKTION CHRISTIAN] vor/nach Deploy von Phase 0
1. **Sicherstellen, dass `GROQ_API_KEY` in Vercel gesetzt ist** — die KI läuft jetzt
   ausschließlich serverseitig. Fehlt der Key, liefern die KI-Routen 503. (Lokal ist er gesetzt.)
2. **`KV_REST_API_URL` + `KV_REST_API_TOKEN` in Vercel prüfen** — ohne sie sind Rate-Limiting,
   Sync-Konfliktschutz und Backups inaktiv (App funktioniert, aber ungeschützt).
3. Optional `PERPLEXITY_API_KEY` in Vercel setzen, falls die Premium-Research wieder gewünscht ist.

---

## Nächster Schritt: Phase 1
Neon Postgres (Frankfurt) + Drizzle-Schema (`tenants/users/entitlements/usage/items`),
Auth.js v5, Datenzugriffs-Hook `useTenantData`, Seed + localStorage-Import, Medien → Vercel Blob.
Details im Umsetzungsprompt. **Voraussetzung:** Neon-Projekt, Resend-Konto, `AUTH_SECRET`,
Vercel-Blob-Store (siehe Prompt, Abschnitt „AKTION CHRISTIAN Phase 1").
