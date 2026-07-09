import type { Metadata } from "next";

export const metadata: Metadata = { title: "Datenschutzerklärung — Raumo" };

const wrap: React.CSSProperties = {
  maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem 5rem",
  fontSize: "0.92rem", lineHeight: 1.7, color: "var(--text)",
};
const h2: React.CSSProperties = { fontFamily: "var(--font-serif)", fontSize: "1.2rem", margin: "2.25rem 0 0.5rem", color: "var(--text)" };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--muted)" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid var(--border)", fontSize: "0.82rem", verticalAlign: "top" };

export default function DatenschutzPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={wrap}>
        <a href="/login" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none" }}>← zurück</a>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", color: "var(--accent)", margin: "1rem 0 0.25rem" }}>Datenschutzerklärung</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: "1rem" }}>Gemäß DSGVO · Stand: Juli 2026</p>

        <h2 style={h2}>1. Verantwortlicher</h2>
        <p>
          Toelsner Digital — Christian Tölsner, Anton-Baumgartner-Straße 44/A2/146, 1230 Wien, Österreich.<br />
          E-Mail: <a href="mailto:christian@toelsner.at" style={{ color: "var(--accent)" }}>christian@toelsner.at</a>. Vollständige Angaben im <a href="/impressum" style={{ color: "var(--accent)" }}>Impressum</a>.
        </p>

        <h2 style={h2}>2. Zwecke &amp; Rechtsgrundlagen</h2>
        <p>Wir verarbeiten personenbezogene Daten, um „Raumo" (KI-gestützter Content-Workspace) bereitzustellen:</p>
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>Bereitstellung des Kontos und der Funktionen — <em>Art. 6 Abs. 1 lit. b DSGVO</em> (Vertragserfüllung).</li>
          <li>Betrieb, Sicherheit, Missbrauchs- und Brute-Force-Schutz — <em>Art. 6 Abs. 1 lit. f DSGVO</em> (berechtigtes Interesse).</li>
          <li>Rechtliche Verpflichtungen (z. B. Aufbewahrung) — <em>Art. 6 Abs. 1 lit. c DSGVO</em>.</li>
        </ul>

        <h2 style={h2}>3. Welche Daten wir verarbeiten</h2>
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li><strong>Kontodaten:</strong> E-Mail-Adresse, Name, Passwort (nur als kryptografischer Hash, nie im Klartext).</li>
          <li><strong>Inhalte:</strong> die von dir im Workspace erstellten/gespeicherten Daten (Ideen, Entwürfe, Texte, Einstellungen, ggf. hochgeladene Bilder).</li>
          <li><strong>KI-Ein- und Ausgaben:</strong> Texte, die du an KI-Funktionen sendest, und deren Ergebnisse.</li>
          <li><strong>Technische Daten:</strong> IP-Adresse (für Rate-Limiting/Sicherheit), Zeitpunkte von An-/Abmeldungen, Fehlerprotokolle.</li>
          <li><strong>Eigene KI-Schlüssel (optional):</strong> hinterlegst du einen eigenen Anbieter-Schlüssel, wird dieser ausschließlich verschlüsselt (AES-256-GCM) gespeichert und nur zur Ausführung deiner Anfragen genutzt.</li>
        </ul>

        <h2 style={h2}>4. Empfänger / Auftragsverarbeiter</h2>
        <p>Zum Betrieb setzen wir sorgfältig ausgewählte Dienstleister als Auftragsverarbeiter (Art. 28 DSGVO)
          ein — Details in der <a href="/avv" style={{ color: "var(--accent)" }}>Auftragsverarbeitungs-Vereinbarung</a>:</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
            <thead><tr><th style={th}>Dienst</th><th style={th}>Zweck</th><th style={th}>Sitz / Ort</th></tr></thead>
            <tbody>
              <tr><td style={td}>Vercel Inc.</td><td style={td}>Hosting / Auslieferung der App</td><td style={td}>USA</td></tr>
              <tr><td style={td}>Neon Inc.</td><td style={td}>Datenbank (Konto &amp; Inhalte)</td><td style={td}>Server EU (Frankfurt), Anbieter USA</td></tr>
              <tr><td style={td}>Upstash Inc.</td><td style={td}>Rate-Limiting, Zwischenspeicher</td><td style={td}>EU/USA</td></tr>
              <tr><td style={td}>Resend</td><td style={td}>Versand von System-E-Mails</td><td style={td}>USA</td></tr>
              <tr><td style={td}>KI-Anbieter (je Auswahl): Groq, OpenAI, Google, Anthropic, Perplexity</td><td style={td}>Ausführung der KI-Funktionen</td><td style={td}>überw. USA</td></tr>
              <tr><td style={td}>Serper.dev, Jina AI</td><td style={td}>Web-Suche/-Auslese für die Recherche-Funktion</td><td style={td}>USA</td></tr>
            </tbody>
          </table>
        </div>

        <h2 style={h2}>5. Übermittlung in Drittländer</h2>
        <p>Einige Dienstleister verarbeiten Daten in den USA. Die Übermittlung erfolgt auf Grundlage der
          EU-Standardvertragsklauseln (Art. 46 DSGVO) bzw. — soweit zertifiziert — des EU-U.S. Data Privacy Framework.</p>

        <h2 style={h2}>6. Speicherdauer</h2>
        <p>Konto- und Inhaltsdaten werden gespeichert, solange dein Konto besteht. Automatische Sicherungen
          werden bis zu 30 Tage aufbewahrt. Auf Wunsch löschen wir deine Daten (siehe Rechte).</p>

        <h2 style={h2}>7. Cookies</h2>
        <p>Wir verwenden ausschließlich technisch notwendige Cookies für die Anmeldung (Session). Es findet
          kein Tracking, keine Analyse und keine Werbung statt — daher ist kein Einwilligungsbanner erforderlich.</p>

        <h2 style={h2}>8. Deine Rechte</h2>
        <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Wende dich dazu an{" "}
          <a href="mailto:christian@toelsner.at" style={{ color: "var(--accent)" }}>christian@toelsner.at</a>.</p>

        <h2 style={h2}>9. Beschwerderecht</h2>
        <p>Du kannst dich bei der österreichischen Datenschutzbehörde beschweren:
          Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien, <a href="https://www.dsb.gv.at" style={{ color: "var(--accent)" }}>dsb.gv.at</a>.</p>

        <p style={{ marginTop: "2.5rem", fontSize: "0.78rem", color: "var(--muted)" }}>
          <a href="/impressum" style={{ color: "var(--accent)" }}>Impressum</a> · Stand: Juli 2026
        </p>
      </div>
    </div>
  );
}
