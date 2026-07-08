# Release-Prozess — Contentraum

Verbindlicher Weg für jede Weiterentwicklung. Ziel: **`main` ist immer lauffähig**
(die „Desi bleibt in jeder Phase arbeitsfähig"-Regel gilt weiter). Strategische
Herleitung: `~/Desktop/contentraum-admin-release-plan.html` (INTERN).

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
