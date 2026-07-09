import type { Metadata } from "next";

export const metadata: Metadata = { title: "AGB — Raumo" };

const wrap: React.CSSProperties = {
  maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem 5rem",
  fontSize: "0.92rem", lineHeight: 1.7, color: "var(--text)",
};
const h2: React.CSSProperties = { fontFamily: "var(--font-serif)", fontSize: "1.15rem", margin: "2rem 0 0.4rem", color: "var(--text)" };

export default function AgbPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={wrap}>
        <a href="/login" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none" }}>← zurück</a>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", color: "var(--accent)", margin: "1rem 0 0.25rem" }}>Allgemeine Geschäftsbedingungen</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: "1rem" }}>für die Nutzung von „Raumo" · Stand: Juli 2026</p>

        <h2 style={h2}>1. Anbieter &amp; Geltungsbereich</h2>
        <p>Diese AGB gelten für die Nutzung des Online-Dienstes „Raumo" (KI-gestützter Content-Workspace),
          angeboten von Toelsner Digital, Christian Tölsner, 1230 Wien (siehe <a href="/impressum" style={{ color: "var(--accent)" }}>Impressum</a>).
          Mit der Registrierung erkennst du diese Bedingungen an.</p>

        <h2 style={h2}>2. Leistung</h2>
        <p>Raumo stellt Werkzeuge zur Ideenfindung, Recherche und Erstellung von Content bereit, teils mit
          KI-Unterstützung. Der Funktionsumfang richtet sich nach dem gewählten Plan. Wir entwickeln den
          Dienst laufend weiter; einzelne Funktionen können sich ändern.</p>

        <h2 style={h2}>3. Registrierung &amp; Konto</h2>
        <p>Für die Nutzung ist ein Konto erforderlich. Du bist für die Geheimhaltung deiner Zugangsdaten
          verantwortlich. Die Angaben bei der Registrierung müssen zutreffend sein.</p>

        <h2 style={h2}>4. Testphase, Pläne &amp; Preise</h2>
        <p>Neue Konten starten mit einer kostenlosen Testphase (derzeit 14 Tage). Danach ist ein
          kostenpflichtiger Plan erforderlich. Alle Preise verstehen sich als Endpreise inklusive etwaiger
          Steuern (Kleinunternehmer gemäß § 6 Abs. 1 Z 27 UStG). Die Abrechnung erfolgt im Voraus, monatlich
          oder jährlich, je nach Wahl.</p>

        <h2 style={h2}>5. Zahlung</h2>
        <p>Die Zahlungsabwicklung erfolgt über unseren Zahlungsdienstleister (Stripe). Bei Zahlungsverzug
          können wir den Zugang einschränken (Nur-Lese) oder aussetzen.</p>

        <h2 style={h2}>6. Laufzeit &amp; Kündigung</h2>
        <p>Das Abo verlängert sich automatisch um die gewählte Periode (Monat/Jahr), sofern nicht vor Ablauf
          gekündigt wird. Die Kündigung ist jederzeit zum Ende der laufenden Periode möglich (über die
          Konto-/Abo-Verwaltung). Nach Kündigung bleiben deine Daten im Nur-Lese-Modus zugänglich; ein Export
          ist möglich.</p>

        <h2 style={h2}>7. Nutzungsrechte &amp; Inhalte</h2>
        <p>Die von dir erstellten Inhalte gehören dir. Du bist für deine Inhalte selbst verantwortlich und
          sicherst zu, keine rechtswidrigen Inhalte zu erstellen oder zu verbreiten. KI-Ergebnisse können
          Fehler enthalten — prüfe sie vor Veröffentlichung. Für KI-generierte Inhalte übernehmen wir keine
          Gewähr auf Richtigkeit, Rechtefreiheit oder Eignung.</p>

        <h2 style={h2}>8. Verfügbarkeit</h2>
        <p>Wir bemühen uns um hohe Verfügbarkeit, schulden aber keine ununterbrochene Erreichbarkeit
          (Wartung, Störungen bei Drittanbietern). Regelmäßige Sicherungen werden erstellt.</p>

        <h2 style={h2}>9. Haftung</h2>
        <p>Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie nach zwingenden gesetzlichen
          Vorschriften. Bei leichter Fahrlässigkeit haften wir nur für die Verletzung wesentlicher
          Vertragspflichten und begrenzt auf den vorhersehbaren, vertragstypischen Schaden.</p>

        <h2 style={h2}>10. Datenschutz</h2>
        <p>Die Verarbeitung personenbezogener Daten ist in der <a href="/datenschutz" style={{ color: "var(--accent)" }}>Datenschutzerklärung</a> geregelt.</p>

        <h2 style={h2}>11. Änderungen &amp; Schlussbestimmungen</h2>
        <p>Wir können diese AGB mit angemessener Vorankündigung ändern. Es gilt österreichisches Recht.
          Ist eine Bestimmung unwirksam, bleibt der Rest wirksam.</p>

        <p style={{ marginTop: "2.5rem", fontSize: "0.78rem", color: "var(--muted)" }}>
          <a href="/impressum" style={{ color: "var(--accent)" }}>Impressum</a> · <a href="/datenschutz" style={{ color: "var(--accent)" }}>Datenschutz</a> · Stand: Juli 2026
        </p>
      </div>
    </div>
  );
}
