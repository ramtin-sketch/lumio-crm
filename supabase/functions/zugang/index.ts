// Zugänge verwalten: nur die Geschäftsführung darf Nutzer anlegen, sperren und Passwörter zurücksetzen.
// Der Service-Schlüssel kommt aus der Umgebung der Funktion und verlässt den Server nie.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const antwort = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function startpasswort() {
  const zeichen = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const zufall = crypto.getRandomValues(new Uint32Array(12));
  const teile = Array.from(zufall, (z) => zeichen[z % zeichen.length]).join("");
  return teile.slice(0, 4) + "-" + teile.slice(4, 8) + "-" + teile.slice(8, 12);
}
const ROLLEN: Record<string, string> = { gf: "gf", setter: "setter", closer: "closer", hv: "handelsvertreter", handelsvertreter: "handelsvertreter" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return antwort({ fehler: "Nur POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const dienst = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";

  // Wer ruft auf? Muss aktive Geschäftsführung sein.
  const alsNutzer = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: istGf, error: e0 } = await alsNutzer.rpc("ist_gf");
  if (e0 || istGf !== true) return antwort({ fehler: "Nur die Geschäftsführung darf Zugänge verwalten." }, 403);

  const admin = createClient(url, dienst, { auth: { persistSession: false } });
  let b: any;
  try { b = await req.json(); } catch { return antwort({ fehler: "Ungültige Anfrage" }, 400); }

  try {
    if (b.aktion === "anlegen") {
      const email = String(b.email ?? "").trim().toLowerCase();
      const name = String(b.name ?? "").trim();
      const rolle = ROLLEN[String(b.rolle ?? "")];
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name || !rolle) return antwort({ fehler: "Name, E-Mail und Rolle angeben." }, 400);
      const zusatz = { stadt: b.stadt || null, farbe: b.farbe || null, gebiet: b.gebiet || null };
      const { error: e1 } = await admin.from("profil_vorbelegung").upsert({
        email, name, rolle, provisionsanteil: b.provisionsanteil ?? null, ...zusatz,
      });
      if (e1) throw e1;
      const passwort = startpasswort();
      const { data: neu, error: e2 } = await admin.auth.admin.createUser({ email, password: passwort, email_confirm: true, user_metadata: { name, passwort_aendern: true } });
      if (e2) {
        if (/already|registered|exists/i.test(e2.message)) return antwort({ fehler: "Diese E-Mail hat schon einen Zugang. Dann bitte Passwort zurücksetzen." }, 409);
        throw e2;
      }
      const kurz = name.split(/\s+/).map((t) => t[0]).join("").slice(0, 2).toUpperCase();
      const { error: e3 } = await admin.from("profil").update({ email, kurz, ...zusatz }).eq("id", neu.user.id);
      if (e3) throw e3;
      return antwort({ id: neu.user.id, email, passwort });
    }

    if (b.aktion === "passwort") {
      const passwort = startpasswort();
      const { error } = await admin.auth.admin.updateUserById(String(b.id), { password: passwort, user_metadata: { passwort_aendern: true } });
      if (error) throw error;
      return antwort({ passwort });
    }

    if (b.aktion === "aktiv") {
      const aktiv = !!b.aktiv;
      const { error: e1 } = await admin.auth.admin.updateUserById(String(b.id), { ban_duration: aktiv ? "none" : "876000h" });
      if (e1) throw e1;
      const { error: e2 } = await admin.from("profil").update({ aktiv }).eq("id", String(b.id));
      if (e2) throw e2;
      return antwort({ aktiv });
    }

    return antwort({ fehler: "Unbekannte Aktion" }, 400);
  } catch (e) {
    return antwort({ fehler: (e as Error).message ?? String(e) }, 500);
  }
});
