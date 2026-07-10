import { PLANS, PLAN_IDS, TRIAL_DAYS } from "@/lib/plans";

// Server-Komponente (kein "use client"): Inhalt landet vollständig im ersten HTML
// → von Google und KI-Suchen (ChatGPT/Perplexity) crawlbar. Strukturierte Daten
// (JSON-LD) unten für Rich Results & GEO.

const PILLARS = [
  {
    icon: "🧠", title: "Kennt deine Marke",
    chat: "Du erklärst bei jedem Prompt neu, wer du bist und wie du klingst.",
    raumo: "Brand Voice, Nische, Zielgruppe, Lieblingsworte & Tabu-Wörter sind hinterlegt und fließen in jede Generierung. Es klingt nach dir – jedes Mal.",
  },
  {
    icon: "🧭", title: "Workflow statt leerem Chat",
    chat: "Leeres Eingabefeld – du musst wissen, was du fragen willst.",
    raumo: "Geführte Strecke: Idee → Research → Erstellen → Repurpose → Planen → Auswerten. Kein Prompt-Wissen nötig.",
  },
  {
    icon: "🗂️", title: "Alles an einem Ort",
    chat: "Ergebnisse versinken im Chat-Verlauf.",
    raumo: "Ideen-Pool, Caption-Bank, Hashtag-Sets, Entwürfe und Kalender – dauerhaft organisiert und wiederverwendbar.",
  },
  {
    icon: "♻️", title: "Aus einem Inhalt viele",
    chat: "Jedes Format einzeln erfragen und zusammenkopieren.",
    raumo: "Repurpose macht aus einem Inhalt Posts, Reel-Ideen, Newsletter & Co – auf Knopfdruck, in deiner Stimme.",
  },
  {
    icon: "🔒", title: "EU & in deiner Hand",
    chat: "US-Konto, Daten im Verlauf des Anbieters.",
    raumo: "EU-Datenbank (Frankfurt), verschlüsselte Schlüssel, tägliche Backups – auf Wunsch mit deinem eigenen KI-Zugang.",
  },
];

const FEATURES = [
  { icon: "🌱", title: "Von der Idee zum Post", text: "Ideen-Pool, Research mit echten Quellen und Trend-Radar – alles an einem Ort." },
  { icon: "🤖", title: "Deine KI, deine Wahl", text: "Groq, GPT, Claude, Gemini, Perplexity – pro Bereich frei wählbar, auf Wunsch mit eigenem Schlüssel." },
  { icon: "🎠", title: "Content, der fertig ist", text: "Karussells, Captions, Hashtags, Blog & Newsletter – sofort veröffentlichbar." },
  { icon: "📅", title: "Planung & Repurpose", text: "Wochenplan, ein Inhalt in viele Formate, Caption-Bank & Northstar." },
  { icon: "📊", title: "Lernen aus Zahlen", text: "Kennzahlen eintragen, Muster erkennen, den nächsten Content gezielter planen." },
  { icon: "🌿", title: "In deinem Ton", text: "Brand Voice in jeder Generierung – es klingt nach dir, nicht nach KI." },
];

const STEPS = [
  { n: "1", title: "Sag, wer du bist", text: "Ein kurzes Profil: dein Thema, deine Zielgruppe, dein Ton. Danach kennt Raumo deine Marke." },
  { n: "2", title: "Erstelle in Minuten", text: "Idee wählen, recherchieren, generieren – Karussell, Caption, Newsletter. Alles in deiner Stimme." },
  { n: "3", title: "Plane & behalte den Überblick", text: "In den Wochenplan ziehen, für weitere Kanäle umwandeln, Ergebnisse auswerten." },
];

const PILLARS3 = [
  { icon: "⏱️", title: "Zeit", text: "Dein Content-Alltag in Minuten statt Abenden." },
  { icon: "🎙️", title: "Stimme", text: "Content, der nach dir klingt – nicht nach KI." },
  { icon: "🍃", title: "Ruhe", text: "Ein Ort statt fünf Apps und Zettel." },
];

const FAQ = [
  {
    q: "Ist Raumo nicht einfach ein teureres ChatGPT?",
    a: "Nein. Du kannst ChatGPT weiter nutzen – Raumo ersetzt nicht die KI, sondern die Stunden drumherum: recherchieren, sortieren, umformulieren, planen. Und die KI in Raumo kennt deine Marke, sodass alles nach dir klingt, ohne dass du es jedes Mal neu erklärst.",
  },
  {
    q: "Brauche ich technisches Wissen oder muss ich Prompten lernen?",
    a: "Nein. Der Einstieg ist ein kurzes Formular: Wer bist du, für wen schreibst du, wie klingst du. Danach führt dich die App durch jeden Schritt – von der Idee bis zum fertigen Post.",
  },
  {
    q: "Klingen die Texte wirklich nach mir?",
    a: "Ja, sobald die KI dich kennt. In Raumo hinterlegst du einmal deine Stimme – Ton, Lieblingsworte, No-Gos – und jede Ausgabe wird daran ausgerichtet. Du bleibst Chefin: alles ist Entwurf, nichts geht ohne dich raus.",
  },
  {
    q: "Was passiert mit meinen Daten?",
    a: "Dein Bereich gehört dir. Die Datenbank liegt in der EU (Frankfurt), du kannst deine Daten jederzeit exportieren, und Impressum, Datenschutz und AVV sind öffentlich einsehbar. Auf Wunsch läuft die KI über deinen eigenen Schlüssel.",
  },
  {
    q: "Was kostet Raumo und wie starte ich?",
    a: `Es gibt drei Pläne ab ${PLANS.starter.monthly} € im Monat, alle inklusive und mit allen Modulen. Du startest mit ${TRIAL_DAYS} Tagen kostenlos und ohne Kreditkarte – wenn es nicht passt, verlierst du nichts.`,
  },
];

function jsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.raumo.eu/#organization",
        name: "Raumo",
        url: "https://www.raumo.eu",
        description: "Content-Betriebssystem für Creator und Coaches – Ideen, KI-Erstellung, Planung und Auswertung an einem Ort.",
        parentOrganization: { "@type": "Organization", name: "Toelsner Digital", url: "https://toelsner.at" },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.raumo.eu/#software",
        name: "Raumo",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://www.raumo.eu",
        description: "Raumo bündelt den ganzen Content-Prozess an einem Ort: Ideen sammeln, mit KI im eigenen Ton erstellen, für jeden Kanal umwandeln, planen und auswerten.",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: String(PLANS.starter.monthly),
          highPrice: String(PLANS.studio.monthly),
          offerCount: String(PLAN_IDS.length),
          offers: PLAN_IDS.map(id => ({
            "@type": "Offer",
            name: `Raumo ${PLANS[id].name}`,
            price: String(PLANS[id].monthly),
            priceCurrency: "EUR",
            description: PLANS[id].tagline,
          })),
        },
      },
      {
        "@type": "FAQPage",
        "@id": "https://www.raumo.eu/#faq",
        mainEntity: FAQ.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
  return JSON.stringify(data);
}

export default function Landing() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.1rem 1.5rem", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", color: "var(--accent)" }}>Raumo</div>
        <nav style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <a href="/login" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>Anmelden</a>
          <a href="/register" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>Kostenlos starten</a>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "4rem 1.5rem 2.5rem", textAlign: "center" }}>
        <div style={{ display: "inline-block", fontSize: "0.75rem", fontWeight: 600, color: "var(--accent2)", background: "var(--accent-light)", padding: "0.3rem 0.8rem", borderRadius: 99, marginBottom: "1.5rem" }}>
          Dein Content-Betriebssystem
        </div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "3rem", lineHeight: 1.12, color: "var(--text)", marginBottom: "1.1rem" }}>
          Mehr Zeit für dein Thema.
        </h1>
        <p style={{ fontSize: "1.15rem", color: "var(--muted)", maxWidth: 580, margin: "0 auto 2rem", lineHeight: 1.6 }}>
          Raumo bündelt deinen ganzen Content-Alltag an einem Ort: Ideen sammeln, mit KI in <em>deinem</em> Ton
          erstellen, für jeden Kanal umwandeln, planen und auswerten. Damit dein Content-Tag Minuten dauert,
          nicht Abende.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/register" className="btn btn-primary" style={{ textDecoration: "none", padding: "0.8rem 1.9rem", fontSize: "1rem" }}>{TRIAL_DAYS} Tage kostenlos starten</a>
          <a href="/login" className="btn btn-secondary" style={{ textDecoration: "none", padding: "0.8rem 1.9rem" }}>Ich habe ein Konto</a>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "1rem" }}>Keine Kreditkarte nötig · jederzeit kündbar · in Sekunden startklar</p>
      </section>

      {/* 3 Säulen: Zeit / Stimme / Ruhe */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "1rem 1.5rem 2.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {PILLARS3.map(p => (
            <div key={p.title} className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "0.4rem" }}>{p.icon}</div>
              <h3 style={{ marginBottom: "0.25rem" }}>{p.title}</h3>
              <p style={{ fontSize: "0.86rem", color: "var(--muted)" }}>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* So funktioniert's */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1.5rem 3rem" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.9rem", textAlign: "center", marginBottom: "0.4rem" }}>In drei Schritten zum fertigen Content</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.9rem", marginBottom: "2rem" }}>Kein Prompt-Wissen nötig – die App führt dich.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
          {STEPS.map(s => (
            <div key={s.n} className="card" style={{ position: "relative" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", color: "var(--accent)", lineHeight: 1, marginBottom: "0.5rem" }}>{s.n}</div>
              <h3 style={{ marginBottom: "0.35rem" }}>{s.title}</h3>
              <p style={{ fontSize: "0.86rem", color: "var(--muted)" }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Warum nicht einfach ChatGPT? */}
      <section style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.9rem", textAlign: "center", marginBottom: "0.4rem" }}>Warum nicht einfach ChatGPT?</h2>
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.9rem", maxWidth: 620, margin: "0 auto 2rem", lineHeight: 1.6 }}>
            Weil die KI nur ein Teil ist. Raumo ist das System drumherum – das aus einem Chatbot deinen
            Arbeitsplatz macht.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {PILLARS.map(p => (
              <div key={p.title} className="card" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1rem", alignItems: "start" }}>
                <div style={{ fontSize: "1.5rem" }} aria-hidden>{p.icon}</div>
                <div>
                  <h3 style={{ marginBottom: "0.5rem" }}>{p.title}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.6rem" }}>
                    <div style={{ fontSize: "0.83rem", color: "var(--muted)" }}>
                      <span style={{ fontWeight: 700, color: "var(--muted)" }}>Chatbot allein: </span>{p.chat}
                    </div>
                    <div style={{ fontSize: "0.83rem", color: "var(--text)" }}>
                      <span style={{ fontWeight: 700, color: "var(--accent2)" }}>Mit Raumo: </span>{p.raumo}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.9rem", textAlign: "center", marginBottom: "0.4rem" }}>Alles, was dein Content-Alltag braucht</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.9rem", marginBottom: "2rem" }}>Ein Login statt fünf Tools.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          {FEATURES.map(f => (
            <div key={f.title} className="card">
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }} aria-hidden>{f.icon}</div>
              <h3 style={{ marginBottom: "0.35rem" }}>{f.title}</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="preise" style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.9rem", textAlign: "center", marginBottom: "0.4rem" }}>Faire Preise, alles inklusive</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.9rem", marginBottom: "2rem" }}>
          Alle Pläne mit allen Modulen. Der Unterschied: dein KI-Kontingent. Preise inkl., jährlich = 2 Monate gratis.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {PLAN_IDS.map(id => {
            const p = PLANS[id];
            return (
              <div key={id} className="card" style={{ textAlign: "center", border: p.highlight ? "2px solid var(--accent)" : undefined, position: "relative" }}>
                {p.highlight && <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", fontSize: "0.68rem", fontWeight: 700, color: "#fff", background: "var(--accent)", padding: "0.15rem 0.7rem", borderRadius: 99 }}>Beliebt</div>}
                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.15rem" }}>{p.name}</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem", minHeight: "2.4em" }}>{p.tagline}</p>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", color: "var(--accent2)" }}>{p.monthly} €<span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>/Mon</span></div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", margin: "0.15rem 0 0" }}>oder {p.yearly} € / Jahr</div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0.6rem 0 1rem" }}>{p.aiMonthlyLimit === 0 ? "KI unbegrenzt" : `${p.aiMonthlyLimit} KI-Aufrufe/Mon`}</div>
                <a href="/register" className="btn btn-primary btn-sm" style={{ textDecoration: "none", width: "100%", justifyContent: "center" }}>{TRIAL_DAYS} Tage testen</a>
              </div>
            );
          })}
        </div>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.78rem", marginTop: "1rem" }}>
          Alle Preise inkl. (Kleinunternehmer, keine USt.) · Start ohne Kreditkarte
        </p>
      </section>

      {/* FAQ */}
      <section style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.9rem", textAlign: "center", marginBottom: "2rem" }}>Häufige Fragen</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {FAQ.map((f, i) => (
              <details key={i} className="card" style={{ padding: "1rem 1.25rem" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.95rem", listStyle: "none" }}>{f.q}</summary>
                <p style={{ fontSize: "0.86rem", color: "var(--muted)", marginTop: "0.75rem", lineHeight: 1.6 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Schluss-CTA */}
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "3.5rem 1.5rem", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", marginBottom: "0.75rem" }}>Wo Ideen Raum finden.</h2>
        <p style={{ color: "var(--muted)", fontSize: "1rem", marginBottom: "1.75rem", maxWidth: 520, margin: "0 auto 1.75rem" }}>
          Probier Raumo {TRIAL_DAYS} Tage kostenlos aus – ohne Kreditkarte. Dein nächster Post kann in wenigen Minuten fertig sein.
        </p>
        <a href="/register" className="btn btn-primary" style={{ textDecoration: "none", padding: "0.85rem 2rem", fontSize: "1rem" }}>Jetzt kostenlos starten</a>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "2rem 1.5rem", textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <a href="/impressum" style={{ color: "var(--muted)", textDecoration: "none" }}>Impressum</a>
          <a href="/datenschutz" style={{ color: "var(--muted)", textDecoration: "none" }}>Datenschutz</a>
          <a href="/agb" style={{ color: "var(--muted)", textDecoration: "none" }}>AGB</a>
          <a href="/avv" style={{ color: "var(--muted)", textDecoration: "none" }}>AVV</a>
        </div>
        made with ❤️ by <a href="https://toelsner.at" target="_blank" rel="noopener" style={{ color: "var(--accent)", textDecoration: "none" }}>Toelsner Digital</a>
      </footer>
    </div>
  );
}
