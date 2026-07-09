# Migration: Desi Hub → „Raumo" SaaS

> **Produktname: Raumo** (2026-07-09). Domain `raumo.eu` registriert (Christian).
> Marken-Vorabprüfung (TMview/EUIPO/ÖPA): kein „RAUMO" in Kl. 9/35/42 — nur
> unähnliche Fremdbranchen (RAUMORA/AT Kl. 37/41 als entferntester Nachbar).
> Claim bleibt „Wo Ideen Raum finden". Vorher: „Contentraum" (verworfen —
> content-raum.com nutzt den Namen in derselben Nische). Codeweite Umbenennung erledigt.


Fortschritts- und Übergabedokument für den Umbau vom Einzelkunden-Tool zum
mandantenfähigen Produkt. Phasenplan siehe `desi-hub-umsetzungsprompt-opus.md`
(auf dem Desktop). **Regel: Desi bleibt in jeder Phase voll arbeitsfähig.**

---

## Status

| Phase | Titel | Status |
|-------|-------|--------|
| 0 | Sicherheits-Härtung des Bestands | ✅ **abgeschlossen** (2026-07-05) |
| A-Sec | Sicherheitsrelevante Audit-Lücken | ✅ **abgeschlossen** (2026-07-07) |
| A2 | LoginGate ins Layout | ✅ **abgeschlossen** (2026-07-07) |
| B | Refactor-Fundament (B1/B2/B5) | ✅ **abgeschlossen** (2026-07-07) — B3/B4 offen |
| H1-Pinterest | Token-Auto-Refresh | ✅ **abgeschlossen** (2026-07-07) |
| C1 | Post-Paket + „Heute"-Cockpit | ✅ **abgeschlossen** (2026-07-07) |
| C2/C3 | Hashtag-Bank im Flow + Brand Voice überall | ✅ **abgeschlossen** (2026-07-07) |
| C4 | Brachliegende KI (Editor-Artikel, Research→Ideenpool) | ✅ **abgeschlossen** (2026-07-07) |
| Multi-KI | Provider-Layer (5 Anbieter) + Modell-Wähler | ✅ **abgeschlossen** (2026-07-07) |
| Release | Release-Prozess (dev-Branch, CI-Gate, RELEASE/CHANGELOG) | ✅ **abgeschlossen** (2026-07-08) |
| Admin-1 | Stufe-1-Admin-Konsole (KV-Flags, /admin) | ✅ **abgeschlossen** (2026-07-08, auf `dev`) |
| 1 | Postgres + echte Logins | 🔵 **in Arbeit** (auf `dev`) — DB-Fundament ✅ + Auth.js ✅, Cutover offen |
| 2 | Entitlements + Admin-Cockpit | ⏳ offen |
| 3 | Theming + Rechtliches | ⏳ offen |
| 4 | Publishing + Analytics | ⏳ offen |
| 5 | Stripe + Ausbau | ⏳ offen (nur Interface vorbereiten) |

Hinweis: A-Sec = der **sicherheitsrelevante Teil** der Audit-Phase A. Die reinen
Stabilitäts-/UX-Punkte von Phase A (LoginGate ins Layout = A2, Robustheits-Bugs =
weiße Seite/Spinner/Editor-Dirty aus A4) sind bewusst NICHT enthalten und bleiben
als Stabilitäts-Arbeit offen (nach dem Sync-Fix kein Sicherheitsthema mehr).

---

## Phase A2 + B + Pinterest (abgeschlossen 2026-07-07)

**A2 · LoginGate ins Root-Layout** — mountete vorher in jeder der 14 Seiten neu und
löste dort `syncDown` + „Laden…"-Flackern bei JEDEM Seitenwechsel aus. Jetzt einmal in
`app/layout.tsx`. Verifiziert: Sidebar bleibt bei Navigation dasselbe DOM-Element.

**Pinterest Token-Auto-Refresh** (`lib/pinterest.ts`) — der `refresh_token` wurde
gespeichert, aber **nie benutzt**: nach Ablauf brach die Verbindung still ab.
`getValidToken()` erneuert jetzt automatisch (10-min-Puffer); `status` unterscheidet
„nie verbunden" von „abgelaufen + Refresh fehlgeschlagen".

**B1 · `lib/types.ts` + `lib/id.ts`** — PlannerItem war 5×, Draft 4× lokal definiert.
`uid()` ersetzt vier ID-Schemata. **Bugfix:** `Date.now().toString(36)` (content, editor)
hatte keinen Zufallsanteil → zwei Einträge in derselben Millisekunde bekamen dieselbe ID.

**B2 · `lib/api.ts` (apiFetch/apiStream)** — 16 von 18 fetch-Callsites umgestellt.
Zentral: Auth-Header, `res.ok`, Timeouts, deutsche Fehlermeldungen, Session-Ablauf.
**Wichtige Unterscheidung:** `requireAuth` liefert `{error:"Unauthorized"}` → Logout;
Pinterest liefert 401 mit eigener Meldung → **kein** Logout (sonst hätte das Verbinden
von Pinterest die Nutzerin ausgeloggt). Raw belassen: `/api/auth` (Login selbst) und der
Sync-Diagnoseklick in Settings.
- Dabei gefunden: **research zeigte Fehler nie an** (catch schrieb in `status`, das
  `finally` leerte ihn sofort) → eigener Fehler-State + Retry-Button.
- `email`: `alert()` → Inline-Meldung.

**B5 · Hygiene** — `next/font` (self-hosted, 0 externe Font-Requests, auch DSGVO),
20 hartkodierte Font-Strings → CSS-Variablen; `dh_instagram_handle` in SYNC_KEYS
(wurde nie synchronisiert) + auf getLS/setLS umgestellt; Foto-Picker lud 720px-Bilder
für 60×60-Kacheln → `thumbUrl()`; `@vercel/kv` (ungenutzt) raus; `tsconfig.tsbuildinfo`
aus Git.

**Noch offen aus Phase B:** B3 (UI-Primitives: Modal/TabBar/useFlash/Confirm) und
B4 (`content/page.tsx` 2.100 Zeilen in Tab-Komponenten splitten).

---

## Phase C1 — Post-Paket + „Heute"-Cockpit (abgeschlossen 2026-07-07)

Größter Workflow-Bruch aus dem Audit behoben: Einplanen aus dem Content-Bereich
schrieb **nur den Titel** in den Planer — Slides, Caption, Hashtags waren am Posttag weg.

- `PlannerItem` hat jetzt `carouselId`/`pinId` (zusätzlich `draftId`). `scheduleCarousel`/
  `schedulePin` sichern den Inhalt automatisch mit + setzen die Referenz.
- `lib/postpaket.ts` — `resolvePaket(item)` löst Referenz → Caption/Hashtags/Slides
  (eine Quelle für Planer + Dashboard). `openTarget()` setzt den Handoff.
- `components/PostPaket.tsx` — Text/Hashtags kopieren + „Öffnen →" (Deep-Link lädt den
  Inhalt via `dh_open_carousel`/`dh_open_pin` zurück ins Content-Modul).
- Planer-Modal zeigt das Paket; Wochenraster: 📎 an verknüpften Posts.
- Dashboard **„Heute fällig"** — heutige + überfällige (noch nicht veröffentlichte) Posts
  mit Kopier-Aktionen. Erster Schritt zum 15-Minuten-Tag (Zukunftsplan H1).
- Nebenbei: Content-Typen nach `lib/types`; restliche kollisionsanfällige IDs → `uid()`.

## Phase C2 + C3 (abgeschlossen 2026-07-07)

**C3 · Brand Voice überall** (`lib/brandvoice.ts`) — Ideen, Pinterest und Newsletter
generierten ohne Brand Voice (nur Karussell schickte sie). Jetzt eine geteilte
`getBrandVoice()`-Quelle; alle 6 KI-Aufrufe senden name/niche/voice/audience mit.

**C2 · Hashtag-Bank im Flow** (`components/HashtagBar.tsx`) — Hashtag-Sets waren eine
Einbahnstraße. Neue Bar im Pinterest-Tab: Set einfügen (dedupliziert) + aktuelle
Hashtags als neues Set sichern.

## Phase C4 (abgeschlossen 2026-07-07)

- **Editor „✍️ Artikel mit KI schreiben"** — der serverseitige `blog`-Prompt war von
  keiner Seite erreichbar. Jetzt: Thema → kompletter Artikel (Titel/Intro/Abschnitte/
  Fazit) als Markdown, mit Brand Voice + Überschreib-Schutz.
- **Research „🌱 In Ideen-Pool"** — Ergebnis als Idee (Tag „Research") mit Kurzfassung +
  Top-Quellen sichern.
- **Research-History speichert Quellen** (`HistoryItem.sources`) — Belegpflicht.
  Bugfix: manueller Save hätte den auto-gesicherten Eintrag sonst quellenlos überschrieben.
- **⚠️ Betrieb:** lokaler `GROQ_API_KEY` (.env.local) ist abgelaufen — Live-KI lokal nicht
  testbar. **Vercel-Key auf Gültigkeit prüfen**, sonst ist KI auch in Produktion tot.

**Noch offen aus Phase C:** Caption-Bank in den Erstell-Flow (Picker); C5 (Autoplan nutzt
Analytics, Repurpose→E-Mail, Vision-Ziele an echte Zahlen). Und weiterhin B3/B4 aus Phase B.

---

## Multi-KI Provider-Layer (abgeschlossen 2026-07-07)

`lib/llm.ts` — ein `chat()` über das OpenAI-kompatible Format für **Groq, OpenAI, Gemini,
Claude (Anthropic-Kompat), Perplexity**. Alle 5 KI-Routen nutzen es; `provider`/`model`
kommen aus dem Request (Default groq), **Keys nur serverseitig**. `extractJson()` für
Anbieter ohne zuverlässiges `response_format`.
- Settings „🤖 KI-Modell": Text-Modell-Dropdown (8) + Research-Modus (Standard/Perplexity),
  in `dh_settings.ai_provider/ai_model/research_engine`; `lib/aichoice.ts` speist die
  10 Client-Aufrufe.
- **Env-Keys** (Vercel, je nach genutztem Anbieter): `OPENAI_API_KEY`, `GEMINI_API_KEY`,
  `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY` (GROQ bestehend). Fehlt ein Key → sauberer 503.
- **Modell-IDs** (Juli 2026, in lib/llm.ts pflegbar): gpt-4o(-mini), gemini-2.5-flash/pro,
  claude-opus-4-8 / sonnet-5 / haiku-4-5-20251001, sonar / sonar-pro / sonar-deep-research.
- **⚠️** Live-Ausgabe je Anbieter braucht den jeweiligen Key auf Vercel; lokal war nur der
  (abgelaufene) Groq-Key vorhanden → verifiziert wurde die Verdrahtung + der 503-Fehlerpfad.

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

## Release-Prozess (eingerichtet 2026-07-08)

Schritt 1 des Admin-/Release-Plans (`~/Desktop/contentraum-admin-release-plan.html`).
**Regel: `main` = Produktion, immer lauffähig.**

- **`dev`-Branch** angelegt und gepusht → Integrationszweig; Vercel erzeugt dafür eine
  Preview-URL. Feature-Arbeit läuft über `dev` (oder Feature-Branch → PR nach `dev`), nie
  direkt auf `main`.
- **CI-Gate** `.github/workflows/ci.yml` — `tsc --noEmit` + `next build` bei jedem Push
  auf `main`/`dev` und jedem PR. `npm run ci` macht dasselbe lokal (verifiziert: Exit 0).
- **`RELEASE.md`** — 5-Schritte-Ablauf, 5-Min-Smoke-Checkliste, Env-Var-Checkliste pro
  Vercel-Projekt, Rollback, einmalige Einrichtung.
- **`CHANGELOG.md`** — Keep-a-Changelog, kundentauglich (wird später „Was ist neu?"-Seite).

**⚠️ Offen (Christian):**
1. **`workflow`-Scope für den gh-Token** — der aktuelle Token (`gist, read:org, repo`)
   darf keine `.github/workflows/`-Dateien pushen. Die CI-Datei liegt lokal bereit, ist
   aber noch **nicht auf GitHub**. Fix (im interaktiven Terminal):
   `gh auth refresh -h github.com -s workflow` → danach wird die Action gepusht.
   Alternativ: Datei-Inhalt über die GitHub-Weboberfläche anlegen.
2. **Test-Upstash-Store** anlegen + im Vercel-**Preview**-Environment die `KV_*`-Vars
   darauf zeigen lassen (Production unberührt) — ~15 Min, Schritte in `RELEASE.md`.
3. **Branch-Protection** auf `main`: Merge nur bei grünem Check „Typecheck + Build".

## Admin-Konsole Stufe 1 (abgeschlossen 2026-07-08, Branch `dev`)

Erstes Feature über den neuen Release-Prozess. Brücke-jetzt/Vollausbau-Phase-2 aus
`~/Desktop/contentraum-admin-release-plan.html`. **Nichts doppelt gebaut:** dieselbe
`guardFeature()`-Schnittstelle liest Phase 2 später aus Postgres statt KV.

**Neue Bausteine**
- `lib/kv.ts` — gemeinsame Upstash-REST-Schicht (getKvConfig/kvGet/kvSet/kvDel),
  zentralisiert das bisher duplizierte KV-Muster.
- `lib/flags.ts` — Flag-Modell `admin_flags_v1` (Module, `ai.enabled`+`monthlyLimit`,
  `status` active/readonly/locked, `banner`), `getFlags()` (30 s Cache, **fail-open**),
  `normalizeFlags()`, `guardFeature({module,ai,write})` → 403, serverseitiger
  KI-Zähler (`admin_ai_usage_<YYYY-MM>` via INCR).
- `lib/admin.ts` — `requireAdmin()` (eigenes **ADMIN_PASSWORD**, `x-admin-token`,
  Konstantzeit, **fail-closed**) + Audit-Log (`admin_audit_log_v1`, letzte 200).
- Routen: `/api/flags` (Kunde, UX), `/api/admin/flags` (GET/POST), `/api/admin/status`,
  `/api/admin/data` (reset/restore + Undo-Snapshot `desi_hub_backup_pre_action`),
  `/api/admin/audit`.
- `app/admin/page.tsx` — geschützte Konsole (eigener Login → Übersicht, Steuerung,
  Daten, Audit). Läuft via Sonderfall in `LoginGate` am Kunden-Login vorbei.
- Enforcement verdrahtet: Sync-POST (write-Guard), alle 5 KI-Routen (ai-Guard +
  Modul-Guard bei research/trends/repurpose/autoplan, generate nur ai-Guard weil geteilt)
  + Verbrauchszählung.
- Client: Sidebar blendet gesperrte Module aus; Banner/Status-Streifen über dem Inhalt.

**Verifiziert (End-to-End gegen Mock-Upstash, echte Routen):** Admin-Auth 401/200;
Flags-POST persistiert; `locked`→Sync-POST 403; `ai.enabled=false`→generate 403;
Modul aus→research 403; `monthlyLimit=1`→2. Aufruf 403 (`aiUsage` zählt); Reset+Undo-
Restore; Audit-Log füllt sich; `/admin`-UI (Login→Save→„Flags gespeichert."); Kunden-
Sidebar verliert gesperrte Module, Banner + Nur-Lese-Streifen erscheinen; keine
Konsolen-Fehler; Build grün.

**⚠️ Offen (Christian):**
1. **`ADMIN_PASSWORD` je Vercel-Projekt setzen** — langes, eigenes Passwort, NIE gleich
   `APP_PASSWORD`. Fehlt es, ist `/admin` komplett gesperrt (fail-closed).
2. KV-abhängige Persistenz greift wie immer nur mit gesetztem `KV_REST_API_URL/TOKEN`
   (auf Vercel vorhanden; lokal fail-open).

**Zentraler Client-Guard (nachgezogen 2026-07-08):** `LoginGate` prüft den aktuellen
Pfad gegen die Flags — ein gesperrtes Modul zeigt an EINER Stelle „Bereich nicht
freigeschaltet" statt des Tools. Deckt Sidebar-Hiding, Deep-Links, Direkt-URLs und
Dashboard-Schnellstarts ab; die APIs bleiben zusätzlich serverseitig geblockt.
Verifiziert: gesperrtes `/research`→Hinweis, freies `/content`→Tool lädt.

## Phase 1 — Postgres + echte Logins (in Arbeit, Branch `dev`)

Setup-Guide für Christian: `~/Desktop/contentraum-phase1-setup.html`. Neon-Projekt
„Contentraum" (Frankfurt) läuft; DB-URLs + `AUTH_SECRET` lokal in `.env.local`.
**⚠️ Neon-Passwort vor Produktivdaten rotieren** (steht im Chatverlauf).

**Increment 1 — DB-Fundament ✅ (2026-07-08)**
- `lib/db/schema.ts`: `tenants/users/entitlements/usage/workspaces` (Drizzle).
  `entitlements` spiegeln die AdminFlags; `workspaces` hält vorerst den Daten-Blob
  1:1 wie `desi_hub_data_v1` → Import ohne Datenverlust.
- `lib/db/index.ts`: Neon serverless HTTP-Client, Platzhalter-Fallback (Build ohne DB).
- `drizzle.config.ts` + `db:push`. Verifiziert gegen Neon (`scripts/verify-db.mjs`):
  Tabellen, Defaults, JSONB-Roundtrip, Cascade-Delete.

**Increment 2 — Auth.js v5 ✅ (2026-07-08)**
- `auth.ts`: Credentials (E-Mail+Passwort), JWT-Session mit `tenantId`+`role`.
  `lib/password.ts` (scrypt). `app/login` (via LoginGate-Bypass). Seed: `scripts/seed-desi.mjs`.
- **Bewusst Passwort statt Magic-Link** → kein Resend nötig zum Start; Desi-Passwort
  bleibt (`desi2024`) für nahtlosen Cutover. Verifiziert gegen Neon: Login→Session mit
  tenantId, falsches PW abgewiesen, Signout leert Session.

**Increment 3a — Login-Cutover ✅ (2026-07-08)**
- `requireAuth()` liest jetzt die Auth.js-Session (statt `x-app-token`); alle 14
  Kunden-Routen `await`. `getSessionContext()` liefert `{tenantId,userId,role}` für 3b.
- `Providers` (SessionProvider) ums Layout; `LoginGate` nutzt `useSession` (Redirect
  `/login` wenn aus, App-Chrome unverändert wenn ein). Logout → `signOut`.
- Alte `/api/auth` (APP_PASSWORD-Login) entfernt. `APP_PASSWORD` env damit vestigial.
- **Login-Log** bekommt vorerst keine neuen Einträge (alte Route weg) — später via
  NextAuth-Event nachrüstbar (unkritisch).
- Verifiziert gegen Neon: unauth→Redirect+401, Login→Dashboard+API 200, KI-Route
  passiert Auth, Admin eigenständig, Logout→/login.

**Increment 3b — Workspace-Daten → Postgres ✅ (2026-07-08)**
- `lib/db/workspace.ts`: `getWorkspace`/`setWorkspace`/`isEmpty` (eine Zeile pro Tenant).
- `app/api/sync/route.ts` neu auf Postgres (statt KV), pro eingeloggtem Tenant via
  `getSessionContext`. Response-Form unverändert → Client (`lib/sync.ts`) unangetastet.
- **Einmaliger Import**: ist der Postgres-Workspace leer, aber der alte KV-Blob
  `desi_hub_data_v1` vorhanden → übernehmen. **Einwegs & non-destruktiv** — der KV-Blob
  bleibt als eingefrorenes Backup. Idempotent: nach einer Änderung kein Re-Import.
- Konflikt-Schutz (409 via `x-last-synced-at`) erhalten. KV-Tages-Backup im Sync entfällt
  (Postgres ist Primärquelle; Backups kommen in 3c).
- **Lokal jetzt voll testbar** (Neon ist lokal gesetzt, KV war es nie): verifiziert gegen
  Neon — GET leer → POST → GET zurück (Daten real in DB) → Konflikt 409; Import aus
  Mock-KV → Postgres geschrieben, KV unberührt, kein Re-Import nach Änderung.

**Increment 3c — Entitlements + Admin → Postgres ✅ (2026-07-08)**
- `lib/flags.ts` liest/schreibt jetzt die `entitlements`-Tabelle (+ `tenants.status`)
  pro Tenant, 30-s-Cache pro Tenant. `guardFeature(tenantId, opts)` — Signatur um
  tenantId erweitert (Phase-2-fertig). Verbrauch → `usage`-Tabelle (INCR pro Tenant/Monat).
- Alle KI-Routen + Sync nutzen jetzt `getSessionContext` → `guardFeature(ctx.tenantId,…)`.
  Kunden-`/api/flags` liest `getEntitlements(session.tenantId)`.
- Admin-Konsole **multi-tenant**: neue `/api/admin/tenants` (Liste), `flags`/`status`/`data`
  nehmen `tenantId`. `app/admin` hat einen Mandanten-Wähler.
- Neue Tabelle `workspace_backups` (On-Demand-Undo-Snapshots, letzte 20/Tenant).
  Daten-Reset/Restore laufen gegen den Postgres-Workspace (Undo „vor Leeren/Einspielen").
- **Audit-Log bleibt KV** (`admin_audit_log_v1`) — funktioniert auf Vercel; lokal ohne KV
  leer. Später optional nach Postgres.
- Verifiziert gegen Neon: Entitlements set/get persistiert (entitlements+tenant.status);
  Kunde: research aus→403, readonly→Sync 403, Banner; KI-Limit 2 → 3. Aufruf 403,
  `usage.ai_calls=2`; Admin-UI Mandanten-Wähler + Reset→Backup→Restore→Undo; keine
  Konsolen-Fehler; npm run ci grün.

**BYOK — kundeneigene KI-Keys ✅ (2026-07-08)**
- Hybrid: Kunden-Key hat Vorrang, sonst Operator-Key (env). Pro Tenant+Provider ein
  **verschlüsselter** Key (`tenant_secrets`, AES-256-GCM via `lib/crypto.ts`,
  `ENCRYPTION_KEY`). Klartext verlässt den Server nie Richtung Client.
- `chat()` nimmt `apiKey`-Override; alle 5 KI-Routen lösen `getTenantKey(tenantId,provider)`
  auf (auch Research-Perplexity-Zweig). `/api/settings/ai-keys` (GET Status / POST setzen /
  DELETE entfernen). `components/AiKeysCard` in den Einstellungen (write-only, zeigt nur
  „eigener Schlüssel ✓/Standard-Zugang").
- Verifiziert gegen Neon: Crypto-Roundtrip; Key setzen→Status true, at-rest nur `v1:`-GCM
  (kein Klartext); generate/openai mit hinterlegtem Bogus-Key → Fehler kommt **von OpenAI**
  (Key wird benutzt); entfernen → Fallback „kein Schlüssel"; GET gibt nie den Key zurück;
  Settings-UI 5 Provider. **Vercel:** `ENCRYPTION_KEY` setzen, sonst ist BYOK deaktiviert
  (Operator-Key gilt weiter).

**Passwort-Reset + Einladung ✅ (2026-07-09)**
- Tabelle `auth_tokens` (nur sha256-Hash gespeichert, purpose reset|invite, TTL).
  `lib/authtokens.ts` (createToken/consumeToken — einmalig verbrauchbar).
  `lib/email.ts` (Resend; **Dev-Fallback**: ohne `RESEND_API_KEY` → Server-Log, Einladungs-
  Link kommt in der Admin-Antwort). Branded E-Mail-Shell.
- Routen: `/api/auth/forgot` (immer 200, kein Leak, rate-limited), `/api/auth/reset`
  (reset ODER invite, min. 8 Zeichen), `/api/admin/invite` (Admin legt passwortlosen
  User an + „Passwort setzen"-Link, 7 Tage). Seiten `/forgot` + `/reset` (LoginGate-Bypass),
  „Passwort vergessen?" im Login, Einladungs-Karte in der Admin-Konsole.
- Verifiziert gegen Neon: forgot→branded Link im Log; reset setzt PW, Token einmalig
  (Reuse→400), <8 Zeichen→400; Login mit neuem PW ✓; Einladung→Link, Dublette→409,
  Invite-Token setzt PW, neuer User loggt sich ein (role member, Desis Tenant); UI rendert;
  keine Konsolen-Fehler; npm run ci grün. **Vercel:** `RESEND_API_KEY` + `AUTH_RESEND_FROM`
  für echten Versand (sonst Link manuell aus der Admin-Antwort).

**P0-Launch-Blocker ✅ (2026-07-09)** — aus dem Prüfbericht `~/Desktop/raumo-pruefbericht-launch-plan.html`:
- **P0-1** Mandanten-Isolation: `clearLocalData()` wischt alle `dh_*`-Keys bei Logout +
  Nutzerwechsel (verhindert Cross-Tenant-Datenleck übers localStorage). Verifiziert.
- **P0-2** Rate-Limits: Login (`auth.ts`, 5/15min) + Admin (`requireAdmin` async, adminLimiter
  10 Fehlversuche/15min). Wie authLimiter → live gegen echtes Upstash scharf.
- **P0-3** Auto-Backups: `/api/cron/backup` (vercel.json, tgl. 03:00 UTC, CRON_SECRET),
  Tages-Snapshot je Tenant, Retention 30. Verifiziert (legt an, idempotent, auth-gated).
- **P0-6** Recht: `/impressum` + `/datenschutz` (öffentlich, Auftragsverarbeiter gelistet).
- **P0-7** Pinterest: per `PINTEREST_ENABLED` standardmäßig AUS (globales Token → unsicher
  im Mehrkundenbetrieb); pro-Tenant-Umbau = P1.
- **Offen für Go-Live (Christian):** P0-4 Deploy (Checkliste im RELEASE.md), P0-5 Secrets
  rotieren. **P1** siehe Prüfbericht.

**Phase 4/5 — Registrierung + Bezahlmodell ✅ (2026-07-09)**
- **Selbst-Registrierung** (`/register`, `/api/auth/register`): Konto+Tenant+14-Tage-Trial+
  Entitlements+Workspace, Planwahl, **AGB**-Zustimmung (`/agb`, `users.agb_accepted_at`),
  Willkommens-Mail. Verifiziert.
- **Pläne** (`lib/plans.ts`): Starter 29 / Pro 59 / Studio 99 €/Mon (jährlich=10×), KI-Kontingent
  150/500/unbegrenzt. **Abo→Entitlements**: `getEntitlements` verrechnet Abo-Status+Plan
  (trial/active/comped→voll, past_due→aktiv+Banner, canceled/Trial-Ende→readonly). Verifiziert
  (Trial-Ende→readonly+Sync 403).
- **Stripe** (gated auf `STRIPE_SECRET_KEY`): `/api/billing/checkout` (Abo+Gutscheincodes),
  `/api/billing/portal`, `/api/webhooks/stripe` (Signatur, schreibt Abo→Postgres),
  `/api/billing/status`. `components/BillingCard` in den Einstellungen (Plan/Trial, Monat/Jahr,
  Checkout, Portal). Ohne Keys → 503, Admin kann manuell freischalten.
- **Admin-Abrechnung** (`/api/admin/billing`, 💳-Sektion): Plan/Status/**Rabatt%**/Trial manuell,
  „Gratis freischalten"/„Testphase +14". Verifiziert.
- **P1-Politur:** Session 30 Tage + updateAge; „Zum Abo"-Link am readonly-Banner.
- **⚠️ Braucht Christian:** Stripe-Konto + Keys + 6 Price-IDs + Webhook `/api/webhooks/stripe`
  (Events checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed).
  `db:push` der neuen Felder auf Prod (billing-Spalten + `users.agb_accepted_at`).

**Launch-Reife-Politur ✅ (2026-07-09)**
- **KI pro Bereich**: `getAiChoice(area)` — Standard-Modell + Overrides je Bereich; „serverseitig"-
  Texte raus, BYOK-Framing. Verifiziert (Content-Anfrage trägt Bereichs-Modell).
- **Landingpage** (`components/Landing`, auf „/" für Ausgeloggte): Hero/Features/Pricing/CTAs.
- **Recht komplett**: `/impressum` `/datenschutz` `/agb` `/avv` (AVV mit Sub-Auftragsverarbeitern).
- `app/robots.ts`: Landing+Recht indexierbar, App/Admin/API disallow.
- **Stripe-Zahlarten** (Apple/Google Pay, Karte, PayPal): rein Dashboard-Sache — Checkout setzt
  kein `payment_method_types`, zeigt also automatisch alle im Dashboard aktivierten Methoden.

**Rest-Kür (offen, P1 — nicht Launch-Blocker)**: Medien → Vercel Blob, Login-Log **pro Tenant**
(aktuell inaktiv/leer; global reaktivieren wäre Privacy-Leak → erst scopen), Pinterest pro Tenant,
Monitoring/Sentry, E2E-Tests, E-Mail-Verifizierung. Der **Multi-Tenant-SaaS ist launch-ready**
(Auth, Daten, Entitlements, BYOK, Reset/Einladung, P0-Security, Registrierung, Abo/Bezahlung/
Rabatte, Recht, Landing).
