# Release-Prozess — Raumo

Verbindlicher Weg für jede Weiterentwicklung. Ziel: **`main` ist immer lauffähig**
(die „Desi bleibt in jeder Phase arbeitsfähig"-Regel gilt weiter).

---

## 🚀 Phase-1-Go-Live (Raumo auf raumo.eu) — einmalige Erst-Inbetriebnahme

Reihenfolge einhalten. Danach ist Raumo live und mehrkunden-sicher.

### A. Konten/Dienste (falls noch nicht)
1. **Neon** (Prod-DB, Frankfurt) — vorhanden. **Passwort rotieren** (Neon → Roles → Reset), weil das alte im Chat stand.
2. **Upstash** Redis-DB anlegen → `KV_REST_API_URL` + `KV_REST_API_TOKEN`. (Ohne KV **kein** Rate-Limiting/Brute-Force-Schutz!)
3. **Resend** — Key vorhanden. **Domain `raumo.eu` verifizieren** (SPF/DKIM/DMARC-Records eintragen) → Absender `login@raumo.eu`.
4. **Serper**-Key neu erzeugen (alter stand im Chat).

### B. Secrets frisch erzeugen (nicht die Dev-Werte nehmen!)
```
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → ENCRYPTION_KEY  (⚠ NIE ändern, sonst sind BYOK-Keys unlesbar)
openssl rand -base64 32   # → CRON_SECRET
```
Dazu ein **langes, eigenes `ADMIN_PASSWORD`** (≠ Kunden-Passwort).

### C. Env-Vars in Vercel setzen (Production)
```
DATABASE_URL           Neon pooled (Host mit -pooler)
DIRECT_URL             Neon direkt (ohne -pooler)
AUTH_SECRET            (frisch)
ENCRYPTION_KEY         (frisch, nie mehr ändern)
ADMIN_PASSWORD         (lang, eigen)
CRON_SECRET            (frisch)
KV_REST_API_URL        Upstash
KV_REST_API_TOKEN      Upstash
RESEND_API_KEY         Resend
AUTH_RESEND_FROM       "Raumo <login@raumo.eu>"
SERPER_API_KEY         (frisch)
GROQ_API_KEY           (Gültigkeit prüfen!) — plus optionale KI-Keys
# NICHT setzen: PINTEREST_ENABLED (bleibt aus = sicher im Mehrkundenbetrieb)
```

### D. Datenbank scharf schalten
1. Schema auf die **Prod-DB** pushen: lokal `DATABASE_URL`/`DIRECT_URL` auf Prod zeigen → `npm run db:push`.
2. Desi seeden: `node scripts/seed-desi.mjs` (legt Tenant + Owner an; ihr KV-Blob importiert sich beim ersten Login automatisch, falls vorhanden).

### E. Merge & Domain
1. Auf einer **Vercel-Preview von `dev`** die Smoke-Checkliste (unten) durchklicken.
2. `dev` → `main` mergen → Auto-Deploy.
3. **DNS `raumo.eu`** → Vercel (A/CNAME laut Vercel-Domain-Setup). In Vercel die Domain dem Projekt zuweisen.
4. Auf `https://raumo.eu` einloggen (Desi), `/impressum` + `/datenschutz` prüfen, `/admin` mit `ADMIN_PASSWORD` testen.

### F. Nach dem Launch prüfen
- Cron läuft (Vercel → Deployments → Cron, oder am Folgetag ein `auto <Datum>`-Backup je Tenant sichtbar).
- Login-Rate-Limit greift (6× falsches Passwort → auch das richtige wird kurz blockiert).
- Rechtsseiten öffentlich erreichbar, im Footer verlinkt.

> **Noch offen (P1, nach Launch):** Session-Härtung, Monitoring/Sentry, erste E2E-Tests,
> Login-Log reaktivieren, Medien→Blob, Pinterest pro Tenant, öffentliche Landingpage,
> Marke „Raumo" anmelden, AVV-Vorlage je Kundin. Siehe `~/Desktop/raumo-pruefbericht-launch-plan.html`.

---

## Der Ablauf in fünf Schritten

| # | Schritt | Wo | Regel |
|---|---------|-----|-------|
| 1 | **Entwickeln** | Branch `dev` (oder Feature-Branch → PR nach `dev`) | Nie direkt auf `main`. Lokal `npm run ci` grün. |
| 2 | **Testen** | Vercel Preview-URL | Jeder Push auf `dev` erzeugt automatisch eine Test-URL mit **eigenem Test-Upstash-Store**. |
| 3 | **Gate** | GitHub Action + Smoke-Test | CI (`tsc` + `build`) muss grün sein. Danach die 5-Minuten-Klickrunde (unten). |
| 4 | **Live** | Merge `dev` → `main` | Auto-Deploy auf Produktion. Eintrag in `CHANGELOG.md`. |
| 5 | **Absichern** | Vercel Instant Rollback | Bei Fehler: Vercel → voriges Deployment → „Promote". Zurück in < 1 Min. |

**Deploy ≠ Release:** Neue Features können deployt, aber per Admin-Flag (Stufe-1-Konsole,
sobald gebaut) ausgeschaltet bleiben — erst selbst testen, dann pro Kundin freischalten.

---

## CI-Gate

`.github/workflows/ci.yml` läuft bei jedem Push auf `main`/`dev` und bei jedem PR:

```
npm ci
npm run typecheck   # tsc --noEmit
npm run build       # next build
```

Ist eines rot, ist der PR nicht mergebar. **Lokal vor jedem Push dasselbe prüfen:**

```
npm run ci
```

---

## Smoke-Checkliste (5 Minuten vor jedem Merge)

Auf der Vercel-Preview-URL durchklicken. Alles muss ohne Console-Fehler laufen:

- [ ] **Login** mit `APP_PASSWORD` — falsches Passwort wird abgewiesen, richtiges lässt rein
- [ ] **Dashboard** lädt, „Heute fällig" zeigt Posts (oder sauber leeren Zustand)
- [ ] **Ein Karussell erstellen** (Content) — KI antwortet oder meldet sauberen Fehler
- [ ] **Einplanen** — Post landet im Planer, 📎-Paket ist am Posttag vorhanden
- [ ] **Einstellungen speichern** (z. B. KI-Modell wechseln) — bleibt nach Reload erhalten
- [ ] **Cloud-Sync** — Footer zeigt „Cloud-Sync aktiv", kein „⚠️ Sync fehlgeschlagen"
- [ ] **Dark-Mode / Theme** — Layout bleibt konsistent, keine gebrochenen Farben
- [ ] **Browser-Konsole** — keine roten Errors

---

## Env-Var-Checkliste (pro Vercel-Projekt)

> Lehre aus dem abgelaufenen Groq-Key: **jede Instanz** braucht ihre eigenen Keys.
> Bei Einzelinstanzen (Modus A) ist jede Kundin ein eigenes Vercel-Projekt.

**Pflicht (App startet, KI läuft):**

- [ ] `APP_PASSWORD` — Login-Passwort
- [ ] `GROQ_API_KEY` — Standard-KI-Anbieter (**Gültigkeit prüfen!**)
- [ ] `SERPER_API_KEY` — Web-Suche (Research/Trends)

**KV / Upstash (Rate-Limit, Sync-Konfliktschutz, Backups):**

- [ ] `KV_REST_API_URL`
- [ ] `KV_REST_API_TOKEN`
- [ ] **Preview-Environment zeigt auf einen SEPARATEN Test-Upstash-Store** — nie auf den
      Produktions-Store, sonst berühren Tests Kundendaten.

**Optional (nur wenn der Anbieter genutzt wird — Multi-KI):**

- [ ] `OPENAI_API_KEY`
- [ ] `GEMINI_API_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `PERPLEXITY_API_KEY`

**Optional (Pinterest-Anbindung):**

- [ ] `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET` / `PINTEREST_CALLBACK_URL`

Fehlt ein KI-Key, liefert die betroffene Route einen sauberen 503 mit deutscher Meldung —
die App bleibt lauffähig.

---

## Mehrere Einzelinstanzen (Modus A)

- Alle Instanzen zeigen auf **dasselbe Repo** → ein Merge nach `main` aktualisiert alle.
- **Gestaffelt ausrollen** (nur bei riskanten Änderungen): Kundinnen-Projekte auf einen
  `release`-Branch pinnen, der `main` zeitversetzt folgt — erst die eigene Instanz, dann
  nach 1–2 Tagen die Kundinnen.
- Nach jedem Deploy mit neuen Env-Vars: obige Checkliste **pro Projekt** durchgehen.

---

## Rollback

- **Code:** Vercel-Dashboard → Deployments → voriges → „Promote to Production" (< 1 Min).
- **Daten:** Tages-Backups aus Phase 0 (`desi_hub_backup_<YYYY-MM-DD>` in KV). Wiederher-
  stellung derzeit manuell über die Upstash-Konsole; der Ein-Klick-Restore kommt mit der
  Stufe-1-Admin-Konsole.

---

## Einmalige Einrichtung (Christian, ~15 Min in Vercel)

1. **Test-Upstash-Store** anlegen (separates Upstash-DB-Projekt).
2. In Vercel unter *Settings → Environment Variables* die `KV_*`-Vars für das
   **Preview**-Environment auf den Test-Store zeigen lassen (Production bleibt auf dem
   echten Store).
3. Optional: dem `dev`-Branch eine feste Domain geben (z. B. `staging.contentraum.at`)
   für längere Tests und zum Vorführen.
4. In GitHub *Settings → Branches* eine Schutzregel auf `main`: Merge nur bei grünem
   CI-Check (Status-Check „Typecheck + Build" required).
