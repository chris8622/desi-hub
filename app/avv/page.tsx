import type { Metadata } from "next";

export const metadata: Metadata = { title: "Auftragsverarbeitung (AVV) — Raumo" };

const wrap: React.CSSProperties = {
  maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem 5rem",
  fontSize: "0.9rem", lineHeight: 1.7, color: "var(--text)",
};
const h2: React.CSSProperties = { fontFamily: "var(--font-serif)", fontSize: "1.15rem", margin: "2rem 0 0.4rem", color: "var(--text)" };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border)", fontSize: "0.78rem", color: "var(--muted)" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid var(--border)", fontSize: "0.8rem", verticalAlign: "top" };

export default function AvvPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={wrap}>
        <a href="/login" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none" }}>← zurück</a>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", color: "var(--accent)", margin: "1rem 0 0.25rem" }}>Auftragsverarbeitung (AVV)</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: "1rem" }}>Vereinbarung gemäß Art. 28 DSGVO · Stand: Juli 2026</p>

        <p>Diese Vereinbarung ist Bestandteil der <a href="/agb" style={{ color: "var(--accent)" }}>AGB</a> und gilt, soweit
          Toelsner Digital (Raumo) im Auftrag der Kundin personenbezogene Daten verarbeitet.</p>

        <h2 style={h2}>1. Rollen</h2>
        <p><strong>Verantwortliche</strong> im Sinne der DSGVO ist die Kundin (Nutzerin von Raumo).
          <strong> Auftragsverarbeiter</strong> ist Toelsner Digital, Christian Tölsner, 1230 Wien
          (siehe <a href="/impressum" style={{ color: "var(--accent)" }}>Impressum</a>).</p>

        <h2 style={h2}>2. Gegenstand, Art &amp; Zweck</h2>
        <p>Verarbeitet werden die von der Kundin in Raumo eingegebenen/erstellten Inhalte sowie die zur
          Kontoführung nötigen Daten — ausschließlich zur Bereitstellung des Dienstes gemäß AGB.
          Betroffene: die Kundin und von ihr erfasste Personen. Datenarten: Konto-, Inhalts- und Nutzungsdaten.</p>

        <h2 style={h2}>3. Weisungen &amp; Vertraulichkeit</h2>
        <p>Wir verarbeiten Daten nur nach dokumentierter Weisung der Kundin (die Nutzung des Dienstes gilt als
          Weisung). Zur Verarbeitung eingesetzte Personen sind zur Vertraulichkeit verpflichtet.</p>

        <h2 style={h2}>4. Technische &amp; organisatorische Maßnahmen (TOM)</h2>
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>Passwörter kryptografisch gehasht; kundeneigene KI-Schlüssel AES-256-GCM verschlüsselt gespeichert.</li>
          <li>Mandantentrennung pro Kundin in der Datenbank; serverseitige Zugriffskontrolle je Konto.</li>
          <li>Transportverschlüsselung (TLS/HTTPS), Rate-Limiting/Brute-Force-Schutz, Security-Header/CSP.</li>
          <li>Tägliche Sicherungen (Aufbewahrung 30 Tage); getrennte Betreiber-Zugänge mit Audit-Log.</li>
          <li>Serverstandort der Datenbank: EU (Frankfurt).</li>
        </ul>

        <h2 style={h2}>5. Unterauftragsverarbeiter</h2>
        <p>Die Kundin stimmt dem Einsatz folgender Unterauftragsverarbeiter zu:</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
            <thead><tr><th style={th}>Dienst</th><th style={th}>Zweck</th><th style={th}>Ort</th></tr></thead>
            <tbody>
              <tr><td style={td}>Vercel Inc.</td><td style={td}>Hosting/Auslieferung</td><td style={td}>USA</td></tr>
              <tr><td style={td}>Neon Inc.</td><td style={td}>Datenbank</td><td style={td}>EU (FRA) / USA</td></tr>
              <tr><td style={td}>Upstash Inc.</td><td style={td}>Rate-Limiting/Cache</td><td style={td}>EU/USA</td></tr>
              <tr><td style={td}>Resend</td><td style={td}>System-E-Mails</td><td style={td}>USA</td></tr>
              <tr><td style={td}>Stripe</td><td style={td}>Zahlungsabwicklung</td><td style={td}>USA/EU</td></tr>
              <tr><td style={td}>KI-Anbieter (Groq, OpenAI, Google, Anthropic, Perplexity)</td><td style={td}>KI-Funktionen</td><td style={td}>überw. USA</td></tr>
              <tr><td style={td}>Serper.dev, Jina AI</td><td style={td}>Web-Recherche</td><td style={td}>USA</td></tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Nutzt die Kundin einen eigenen KI-Schlüssel (BYOK), erfolgt die KI-Verarbeitung über ihr eigenes Anbieterkonto.
          Änderungen der Liste werden mit angemessener Frist mitgeteilt; ein Widerspruchsrecht besteht.</p>

        <h2 style={h2}>6. Drittland</h2>
        <p>Übermittlungen in die USA erfolgen auf Grundlage der EU-Standardvertragsklauseln bzw. — soweit
          zertifiziert — des EU-U.S. Data Privacy Framework.</p>

        <h2 style={h2}>7. Unterstützung, Löschung, Nachweise</h2>
        <p>Wir unterstützen die Kundin bei Betroffenenanfragen und Datenschutz-Pflichten, melden Datenschutz-
          verletzungen unverzüglich, und löschen bzw. geben die Daten nach Vertragsende zurück (soweit keine
          gesetzliche Aufbewahrung besteht). Auf Anfrage stellen wir die zur Nachweisführung nötigen
          Informationen bereit.</p>

        <p style={{ marginTop: "2.5rem", fontSize: "0.78rem", color: "var(--muted)" }}>
          <a href="/impressum" style={{ color: "var(--accent)" }}>Impressum</a> · <a href="/datenschutz" style={{ color: "var(--accent)" }}>Datenschutz</a> · <a href="/agb" style={{ color: "var(--accent)" }}>AGB</a>
        </p>
      </div>
    </div>
  );
}
