# Migration: Desi Hub → „Creator Hub" SaaS

Fortschritts- und Übergabedokument für den Umbau vom Einzelkunden-Tool zum
mandantenfähigen Produkt. Phasenplan siehe `desi-hub-umsetzungsprompt-opus.md`
(auf dem Desktop). **Regel: Desi bleibt in jeder Phase voll arbeitsfähig.**

---

## Status

| Phase | Titel | Status |
|-------|-------|--------|
| 0 | Sicherheits-Härtung des Bestands | ✅ **abgeschlossen** (2026-07-05) |
| A-Sec | Sicherheitsrelevante Audit-Lücken | ✅ **abgeschlossen** (2026-07-07) |
| 1 | Postgres + echte Logins | ⏳ offen |
| 2 | Entitlements + Admin-Cockpit | ⏳ offen |
| 3 | Theming + Rechtliches | ⏳ offen |
| 4 | Publishing + Analytics | ⏳ offen |
| 5 | Stripe + Ausbau | ⏳ offen (nur Interface vorbereiten) |

Hinweis: A-Sec = der **sicherheitsrelevante Teil** der Audit-Phase A. Die reinen
Stabilitäts-/UX-Punkte von Phase A (LoginGate ins Layout = A2, Robustheits-Bugs =
weiße Seite/Spinner/Editor-Dirty aus A4) sind bewusst NICHT enthalten und bleiben
als Stabilitäts-Arbeit offen (nach dem Sync-Fix kein Sicherheitsthema mehr).

---

## Phase A-Sec — Sicherheitsrelevante Lücken (abgeschlossen 2026-07-07)

Aus dem Tiefen-Audit vorgezogen, damit der Hub übergabe-/hosting-tauglich wird.

**S1 · XSS geschlossen** — `app/repurpose/page.tsx`: der KI-Newsletter (`newsletter_body`)
wurde per `dangerouslySetInnerHTML` **roh** gerendert → jetzt durch `sanitizeHtml()`
(`lib/sanitize.ts`, dieselbe Allowlist, die Research nutzt). Editor-Vorschau ist safe
(escaped HTML zuerst), Research war schon safe. **Verifiziert:** `<script>`, `onerror`,
`javascript:`-href und `<iframe>` werden neutralisiert.

**S2 · Auth gehärtet** — `lib/server-auth.ts`: Passwort-/Token-Vergleich jetzt
konstantzeit (`crypto.timingSafeEqual` über SHA-256-Digests, kein Timing-/Längen-Leak)
statt `!==`. Neuer Helfer `readJson()` fängt kaputtes JSON ab → **400 statt 500** in
allen 7 Routen (auth, generate, repurpose, autoplan, research, trends; pinterest/pin
war schon abgesichert). **Verifiziert (curl):** falsch→401, richtig→200, kaputt→400,
ohne Token→401.

**S3 · CSV-Injection entschärft** — `app/email/page.tsx`: der Abonnenten-Export
prefixt führende `= + - @` Tab/CR mit `'` (Formula-Injection in Excel/Sheets) und
escaped Anführungszeichen (`"`→`""`, kein Feld-Ausbruch). **Verifiziert.**

**S4 · Security-Header + CSP** — `next.config.ts`: CSP (default-src 'self';
img data:/blob:/https:; connect 'self'; frame-ancestors 'none'; object-src 'none';
base-uri/form-action 'self'; Google Fonts erlaubt), dazu X-Frame-Options DENY,
X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, `poweredByHeader:false`.
`script/style-src` brauchen `'unsafe-inline'` (durchgehende Inline-Styles + Next-Hydration
ohne Nonce). `'unsafe-eval'`/Websockets nur in **Dev** (HMR); **Prod ist strenger**.
**Verifiziert:** Header per curl gegen `next start` korrekt; App rendert unter CSP
fehlerfrei (Fonts laden, keine Violations). **TODO Phase 1:** script-src via Nonce +
Middleware verschärfen (`'unsafe-inline'` raus).

**S5 · Sync-Datenverlust behoben** — `lib/sync.ts` + `components/LoginGate.tsx`:
- **Dirty-Flag** (`desi_dirty`): jede Änderung markiert sofort dirty (verifiziert).
- **flush-before-syncDown**: vor jedem Download werden ausstehende lokale Änderungen
  erst hochgeladen; schlägt das fehl (offline), wird der Server-Stand NICHT drübergeschrieben
  (lokal gewinnt) → schließt den Race beim schnellen Seitenwechsel.
- **Sichtbarer Fehlerstatus**: `syncUp` meldet per Event `desi-sync`; Footer zeigt bei
  413/500/Netzfehler „⚠️ Sync fehlgeschlagen …" statt weiter „Cloud-Sync aktiv".
- **Unload-Flush**: `flushOnHide` bei `visibilitychange`/`pagehide` (keepalive) rettet
  Änderungen beim Tab-Schließen.
- Konflikt-Fall (409) bleibt „Server gewinnt" (Phase 0); echter Feld-Merge kommt mit
  der DB in Phase 1.

**Nicht lokal testbar (aktiv auf Vercel):** die volle Sync-Runde (dirty→synced) und
Rate-Limits brauchen Upstash-KV; lokal greift „nur lokal gespeichert". Client-Logik
(Dirty-Flag, Flush-Guards) ist per Code + Flag-Lifecycle verifiziert.

**Noch offen fürs Multi-Tenant (Phase-1-Pflicht, NICHT jetzt gelöst):** globaler
Sync-Key `desi_hub_data_v1`, Login-Log global sichtbar, Pinterest-OAuth-State global,
Klartext-Passwort-als-Token (löst Auth.js in Phase 1). AVV-Liste für Datenschutz:
Groq, Serper, Jina, Perplexity, Pinterest, Upstash, Vercel.

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
