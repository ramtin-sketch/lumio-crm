// Nach dem Bauen: Content-Security-Policy in dist/index.html eintragen.
// Erlaubt sind nur die Skripte, die wir selbst ausliefern (per Prüfsumme), und die Dienste, die die App braucht.
// Eingeschleuster Code (z. B. über einen Lead-Namen) kann dadurch nicht laufen und keine Daten nach außen schicken.
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"

const datei = new URL("../dist/index.html", import.meta.url)
let html = readFileSync(datei, "utf8")
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => "'sha256-" + createHash("sha256").update(m[1], "utf8").digest("base64") + "'")
if (!hashes.length) throw new Error("Keine Skripte gefunden – CSP nicht gesetzt")

const SUPABASE = "https://ehgjsvpbzgmlcgingkel.supabase.co"
const regeln = {
  "default-src": ["'self'"],
  "script-src": [...new Set(hashes)],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
  "img-src": ["'self'", "data:", "blob:", SUPABASE, "https://tile.openstreetmap.org"],
  "connect-src": ["'self'", "data:", "blob:", SUPABASE, SUPABASE.replace("https://", "wss://"), "https://nominatim.openstreetmap.org"],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
  "frame-src": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'self'"],
}
const csp = Object.entries(regeln).map(([k, v]) => k + " " + v.join(" ")).join("; ")
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/g, "")
html = html.replace(/<meta charset="utf-8">/i, (m) => m + `\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<meta name="referrer" content="strict-origin-when-cross-origin">`)
writeFileSync(datei, html)
console.log("CSP gesetzt (" + hashes.length + " Skripte)")
