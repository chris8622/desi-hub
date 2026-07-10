// TEMPORÄR — nur zum Verifizieren, dass Fehler in GlitchTip ankommen.
// Nach erfolgreichem Test wieder entfernen. Wirft absichtlich einen Fehler,
// der über onRequestError (instrumentation.ts) an GlitchTip gemeldet wird.
export async function GET() {
  throw new Error(`GlitchTip-Testfehler von Raumo — ${new Date().toISOString()}`);
}
