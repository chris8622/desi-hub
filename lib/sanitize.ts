// Leichter HTML-Sanitizer für LLM-Output (Allowlist-Ansatz, keine Dependency).
// Hintergrund: Die Research-Zusammenfassung ist KI-generiertes HTML, dessen
// Input gescrapter Web-Content ist — eine präparierte Seite könnte per
// Prompt-Injection Script-Tags/Event-Handler einschleusen (XSS → Token-Diebstahl).
//
// Erlaubt sind nur die Tags, die unsere Prompts anfordern, ohne Attribute
// (außer einem geprüften style/href-Subset für interne Fehlermeldungen).

const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "p", "ul", "ol", "li",
  "strong", "em", "b", "i", "br", "blockquote", "hr", "div", "span", "a",
]);

export function sanitizeHtml(html: string): string {
  if (!html) return "";

  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    const isClosing = match.startsWith("</");

    // Nicht erlaubte Tags (script, img, iframe, svg, …) komplett entfernen
    if (!ALLOWED_TAGS.has(tag)) return "";

    if (isClosing) return `</${tag}>`;

    // Attribute filtern: nur ein harmloses style-Subset und sichere hrefs
    let safeAttrs = "";

    const styleMatch = attrs.match(/style\s*=\s*"([^"]*)"/i);
    if (styleMatch && /^[a-zA-Z0-9\s:;,#%().\-]*$/.test(styleMatch[1]) && !/expression|url\s*\(/i.test(styleMatch[1])) {
      safeAttrs += ` style="${styleMatch[1]}"`;
    }

    if (tag === "a") {
      const hrefMatch = attrs.match(/href\s*=\s*"([^"]*)"/i);
      if (hrefMatch && /^(https?:\/\/|\/)/i.test(hrefMatch[1])) {
        safeAttrs += ` href="${hrefMatch[1]}" target="_blank" rel="noopener noreferrer"`;
      }
    }

    return `<${tag}${safeAttrs}>`;
  });
}
