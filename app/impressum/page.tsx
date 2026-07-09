import type { Metadata } from "next";

export const metadata: Metadata = { title: "Impressum — Raumo" };

const wrap: React.CSSProperties = {
  maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem 5rem",
  fontSize: "0.95rem", lineHeight: 1.7, color: "var(--text)",
};
const h2: React.CSSProperties = { fontFamily: "var(--font-serif)", fontSize: "1.2rem", margin: "2rem 0 0.5rem", color: "var(--text)" };

export default function ImpressumPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={wrap}>
        <a href="/login" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none" }}>← zurück</a>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", color: "var(--accent)", margin: "1rem 0 0.25rem" }}>Impressum</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: "1rem" }}>Angaben gemäß § 5 ECG, § 25 MedienG</p>

        <h2 style={h2}>Medieninhaber &amp; Diensteanbieter</h2>
        <p>
          <strong>Toelsner Digital</strong> — Christian Tölsner<br />
          Anton-Baumgartner-Straße 44/A2/146<br />
          1230 Wien, Österreich
        </p>

        <h2 style={h2}>Kontakt</h2>
        <p>
          E-Mail: <a href="mailto:christian@toelsner.at" style={{ color: "var(--accent)" }}>christian@toelsner.at</a><br />
          Telefon: +43 664 500 11 80<br />
          Web: <a href="https://toelsner.at" style={{ color: "var(--accent)" }}>toelsner.at</a>
        </p>

        <h2 style={h2}>Unternehmensgegenstand</h2>
        <p>Werbeagentur (freies Gewerbe) · Webdesign, Software- und KI-Dienstleistungen.<br />
          GISA-Zahl: 39708205 · Gewerbebehörde: Magistrat der Stadt Wien.</p>

        <h2 style={h2}>Umsatzsteuer</h2>
        <p>Kleinunternehmer gemäß § 6 Abs. 1 Z 27 UStG — es wird keine Umsatzsteuer ausgewiesen.</p>

        <h2 style={h2}>Verbraucherstreitbeilegung</h2>
        <p>Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
          sind wir nicht verpflichtet und nicht bereit.</p>

        <p style={{ marginTop: "2.5rem", fontSize: "0.78rem", color: "var(--muted)" }}>
          <a href="/datenschutz" style={{ color: "var(--accent)" }}>Datenschutzerklärung</a> · Stand: Juli 2026
        </p>
      </div>
    </div>
  );
}
