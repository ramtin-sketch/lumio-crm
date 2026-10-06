import { useLiveHinweis } from "@/live-hinweis"
import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { BereichBadge, StatusBadge, StufeBadge } from "@/bits"
import { Ergebnis } from "@/ergebnis"
import { UebergabeKarte } from "@/uebergabe"
import * as K from "@/model/karte.js"
import { anonymisieren, fotoUrls } from "@/daten/echt"
import { bump, neuZeichnen, useDaten, useUI } from "@/store"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { Map as MapIcon, Mail, Navigation, Phone, ShieldBan, Trash2, UserPlus } from "lucide-react"

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return <section className="space-y-3"><Separator /><h3 className="pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{titel}</h3>{children}</section>
}
function Feld({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}

export function LeadSheet() {
  useDaten()
  const ui = useUI()
  const l = ui.detail !== null ? M.LEADS.find((x: any) => x.id === ui.detail) : null
  useLiveHinweis("lead", l?.id, "hat diesen Lead gerade geändert. Du siehst schon den neuen Stand.")
  return (
    <Sheet open={!!l} onOpenChange={(o) => !o && ui.oeffne(null)}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {l && <Inhalt key={l.id} l={l} />}
      </SheetContent>
    </Sheet>
  )
}

function Inhalt({ l }: { l: any }) {
  const ui = useUI()
  const m = M.mandat(l.mandat), gf = ui.istGF, tel = M.istTel(l)
  const [abschlussAuf, setAbschlussAuf] = React.useState(false)
  const [kontaktAuf, setKontaktAuf] = React.useState(false)
  const [loeschAuf, setLoeschAuf] = React.useState(false)
  const sperre = M.sperrTreffer(l)
  const kGesperrt = (k: any) => M.SPERRLISTE.some((e: any) => (k.tel && e.telefon === M.telNorm(k.tel)) || (k.mail && e.email === M.mailNorm(k.mail)))
  const aendern = (fn: () => void, msg?: string) => { fn(); bump(); if (msg) toast(msg) }
  const gfs = M.PERSONEN.filter((p: any) => p.rolle === "gf"), innen = M.PERSONEN.filter((p: any) => p.rolle !== "hv"), hvs = M.PERSONEN.filter((p: any) => p.rolle === "hv")

  const form = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string> }

  return (
    <>
      <SheetHeader className="gap-2 border-b pb-4">
        <div className="flex flex-wrap gap-1.5 pr-8"><BereichBadge b={l.bereich} /><StufeBadge l={l} />
          {l.temp === 2 && <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">heiß</Badge>}
          {l.temp === 1 && <Badge variant="outline" className="border-transparent bg-warn/15 text-warn">warm</Badge>}
        </div>
        <SheetTitle className="text-xl">{l.name}</SheetTitle>
        <SheetDescription>{l.ort}{l.adresse ? ", " + l.adresse : ""} · {m.name}</SheetDescription>
      </SheetHeader>

      <div className="space-y-5 p-4">
        {tel && l.uebergabe && <UebergabeKarte l={l} />}
        <div className="grid grid-cols-2 gap-3">
          <Feld id="dst" label="Phase">
            <NativeSelect id="dst" value={l.stufe} onChange={(e) => {
              const v = e.target.value
              if (v === "gewonnen") { setAbschlussAuf(true); toast("Erst die Eckdaten eintragen, dann ist es gewonnen."); return }
              aendern(() => { l.stufe = v; if (v === "verloren") { l.next = null; M.verlustAufTermin(l) } M.verlauf(l, ui.ich, "stufe", "Phase: " + M.stufeVon(l).name) })
            }}>
              {M.STUFEN[l.bereich].map((s: any) => <NativeSelectOption key={s.id} value={s.id} disabled={s.id === "gewonnen" && !gf}>{s.name}{s.id === "gewonnen" && !gf ? " (trägt GF ein)" : ""}</NativeSelectOption>)}
            </NativeSelect>
          </Feld>
          {tel || gf ? (
            <Feld id="dbe" label={tel ? "Betreut von" : "Handelsvertreter"}>
              <NativeSelect id="dbe" value={l.betreuer} onChange={(e) => aendern(() => { l.betreuer = e.target.value; M.verlauf(l, ui.ich, "notiz", "Übergeben an " + M.person(e.target.value).name) })}>
                {(tel ? innen : hvs).map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.voll}</NativeSelectOption>)}
              </NativeSelect>
            </Feld>
          ) : <Feld id="x" label="Handelsvertreter"><div className="py-2 text-sm">{M.person(l.betreuer).voll}</div></Feld>}
          {tel && ["setter", "closer"].map((r) => (
            <Feld key={r} id={"d" + r} label={r === "setter" ? "Gesetzt von" : "Geclosed von"}>
              <NativeSelect id={"d" + r} value={l[r] || ""} onChange={(e) => aendern(() => { l[r] = e.target.value || null })}>
                <NativeSelectOption value="">—</NativeSelectOption>
                {(r === "setter" ? innen : gfs).map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.voll}</NativeSelectOption>)}
              </NativeSelect>
            </Feld>
          ))}
          {l.stufe === "verloren" && (
            <div className="col-span-2"><Feld id="dgr" label="Grund">
              <NativeSelect id="dgr" value={l.verlustgrund || ""} onChange={(e) => aendern(() => { l.verlustgrund = e.target.value || null })}>
                <NativeSelectOption value="">bitte wählen</NativeSelectOption>
                {M.EINWAENDE.concat(["Netzanschluss zu schwach", "Mandant lehnt Lage ab", "Eigentümer will nicht", "Sonstiges"]).map((g: string) => <NativeSelectOption key={g} value={g}>{g}</NativeSelectOption>)}
              </NativeSelect>
            </Feld></div>
          )}
        </div>

        {l.geo && (
          <div className="overflow-hidden rounded-lg border">
            {l.fotos?.length > 0 && (
              <div className="flex gap-1 overflow-x-auto border-b p-1">
                <Fotos pfade={l.fotos} />
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{l.ort}{l.stadt ? " · " + K.STAEDTE.find((s: any) => s.id === l.stadt)?.name : ""}</div>
                <div className="text-xs text-muted-foreground">
                  {l.erfasst ? `Vor Ort erfasst von ${M.person(l.erfasst.wer)?.name} am ${M.dKurz(l.erfasst.datum)} um ${l.erfasst.zeit}` + (l.erfasst.quelle === "gps" ? (l.erfasst.genau ? ` · GPS ±${Math.round(l.erfasst.genau)} m` : " · GPS") : l.erfasst.quelle === "link" ? " · aus Karten-Link" : " · Beispiel")
                    : (() => { const o = K.besitzer(K.unit(l.unit)); return o ? "Im Gebiet von " + M.person(o).name : "Freies Gebiet" })()}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="xs" onClick={() => ui.zeigeAufKarte(l.id)}><MapIcon />Karte</Button>
                <Button asChild variant="outline" size="xs"><a href={K.routeLink(l.geo)} target="_blank" rel="noreferrer"><Navigation />Route</a></Button>
              </div>
            </div>
          </div>
        )}

        {l.abschluss ? (
          <Abschnitt titel={tel ? "Abschluss" : "Freigabe"}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Datum</dt><dd>{M.dKurz(l.abschluss.datum)}{l.abschluss.datum.slice(0, 4)}</dd>
              {m.k.typ === "marge" && <><dt className="text-muted-foreground">Vertrag</dt><dd>{l.abschluss.laufzeit} Monate × {M.eur(l.abschluss.monatsbeitrag)}</dd></>}
              {m.k.typ === "prozent" && <><dt className="text-muted-foreground">Kampagne</dt><dd>{M.eur(l.abschluss.volumen)}</dd></>}
              {m.k.typ === "kopf" && <><dt className="text-muted-foreground">Teilnehmer</dt><dd>{l.abschluss.teilnehmer} × {M.eur(l.abschluss.dealgroesse)}</dd></>}
              {M.kundenwert(l) && <><dt className="text-muted-foreground">Kundenwert</dt><dd className="tabular">{M.eur(M.kundenwert(l))}</dd></>}
              <dt className="text-muted-foreground">LUMIO</dt><dd className="font-semibold tabular">{M.eur(M.lumioGesamt(l))}{m.k.typ === "marge" && <span className="font-normal text-muted-foreground"> · {M.eur(l.abschluss.monatsbeitrag * m.k.satz / 100)} pro Monat</span>}</dd>
              {M.hvAnteil(l) > 0 && <><dt className="text-muted-foreground">Handelsvertreter</dt><dd className="tabular">{M.eur(M.hvAnteil(l))} an {M.person(l.betreuer).voll}</dd></>}
              <dt className="text-muted-foreground">Status</dt><dd><StatusBadge s={l.abschluss.status} /></dd>
            </dl>
          </Abschnitt>
        ) : M.istOffen(l) && gf && (
          <Abschnitt titel={tel ? "Abschluss" : "Freigabe"}>
            {!abschlussAuf ? <Button variant="outline" size="sm" onClick={() => setAbschlussAuf(true)}>{tel ? "Abschluss erfassen" : "Freigabe vom Mandanten eintragen"}</Button> : (
              <form className="space-y-3 rounded-lg border bg-muted/40 p-3" onSubmit={(e) => { const w = form(e); aendern(() => toast(M.abschliessen(l, ui.ich, w))); setAbschlussAuf(false) }}>
                {m.k.typ === "marge" && <div className="grid grid-cols-2 gap-3">
                  <Feld id="al" label="Laufzeit"><NativeSelect id="al" name="laufzeit" defaultValue="24">{[12, 24, 36].map((n) => <NativeSelectOption key={n} value={n}>{n} Monate</NativeSelectOption>)}</NativeSelect></Feld>
                  <Feld id="am" label="Monatsbeitrag Kunde (€)"><Input id="am" name="monatsbeitrag" type="number" min={1} defaultValue={690} required /></Feld>
                </div>}
                {m.k.typ === "prozent" && <Feld id="av" label="Kampagnenvolumen (€)"><Input id="av" name="volumen" type="number" min={1} defaultValue={15000} required /></Feld>}
                {m.k.typ === "kopf" && <div className="grid grid-cols-2 gap-3">
                  <Feld id="at" label="Teilnehmer"><Input id="at" name="teilnehmer" type="number" min={1} defaultValue={1} required /></Feld>
                  <Feld id="ad" label="Dealgröße je Teilnehmer (€)"><Input id="ad" name="dealgroesse" type="number" min={1} defaultValue={8000} required /></Feld>
                </div>}
                {m.k.typ === "fix" && <p className="text-sm">Fest {M.eur(m.k.betrag)} für LUMIO{m.hv ? `, davon ${M.eur(m.k.betrag * m.hv / 100)} an ${M.person(l.betreuer).voll}` : ""}.</p>}
                <p className="text-xs text-muted-foreground">{m.ktext}</p>
                <div className="flex gap-2"><Button type="submit" size="sm">{tel ? "Abschluss speichern" : "Freigabe speichern"}</Button><Button type="button" variant="ghost" size="sm" onClick={() => setAbschlussAuf(false)}>Abbrechen</Button></div>
              </form>
            )}
          </Abschnitt>
        )}

        {sperre && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldBan className="mt-0.5 size-4 shrink-0" /><span>Auf der Sperrliste seit {M.dKurz(sperre.datum)}: {sperre.grund}. Nicht mehr anrufen oder anschreiben.</span>
          </div>
        )}

        {M.istOffen(l) && (
          <>
            {!(sperre && tel) && <Abschnitt titel={(tel ? "Anruf" : "Besuch") + " protokollieren"}><Ergebnis l={l} /></Abschnitt>}
            <Abschnitt titel="Nächster Schritt">
              <form key={JSON.stringify(l.next)} className="grid gap-3" onSubmit={(e) => { const w = form(e); aendern(() => { l.next = w.datum ? { datum: w.datum, zeit: w.zeit || null, text: w.text || "Wiedervorlage" } : null }, l.next || w.datum ? "Nächster Schritt gespeichert" : undefined) }}>
                <div className="grid grid-cols-2 gap-3">
                  <Feld id="nd" label="Datum"><Input id="nd" name="datum" type="date" defaultValue={l.next?.datum || ""} /></Feld>
                  <Feld id="nz" label="Uhrzeit"><Input id="nz" name="zeit" type="time" defaultValue={l.next?.zeit || ""} /></Feld>
                </div>
                <div className="flex items-end gap-2"><div className="flex-1"><Feld id="nt" label="Was"><Input id="nt" name="text" defaultValue={l.next?.text || ""} placeholder="z. B. Rückruf Geschäftsführer" /></Feld></div><Button type="submit" size="sm" className="h-9">Speichern</Button></div>
              </form>
            </Abschnitt>
          </>
        )}

        <Abschnitt titel="Angaben">
          <form className="space-y-3" onSubmit={(e) => { const w = form(e); aendern(() => { m.felder.forEach((f: any) => { l.felder[f.key] = w[f.key] || "" }) }, "Angaben gespeichert") }}>
            <div className="grid grid-cols-2 gap-3">
              {m.felder.map((f: any) => <Feld key={f.key} id={"f_" + f.key} label={f.label}><Input id={"f_" + f.key} name={f.key} type={f.typ === "zahl" ? "number" : "text"} defaultValue={l.felder[f.key] || ""} /></Feld>)}
            </div>
            <Button type="submit" variant="outline" size="sm">Angaben speichern</Button>
          </form>
        </Abschnitt>

        <Abschnitt titel="Ansprechpartner">
          <div className="divide-y rounded-lg border">
            {l.kontakte.length === 0 && <div className="p-3 text-sm text-muted-foreground">Noch keiner erfasst.</div>}
            {l.kontakte.map((k: any, i: number) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div><div className="text-sm font-medium">{k.name}{kGesperrt(k) && <Badge variant="outline" className="ml-2 border-transparent bg-destructive/10 text-destructive">gesperrt</Badge>}</div>{k.funktion && <div className="text-xs text-muted-foreground">{k.funktion}</div>}</div>
                <div className="flex gap-1.5">
                  {k.tel && !kGesperrt(k) && <Button asChild variant="outline" size="xs" className="font-mono"><a href={"tel:" + k.tel.replace(/\s/g, "")}><Phone />{k.tel}</a></Button>}
                  {k.mail && <Button asChild variant="outline" size="xs"><a href={"mailto:" + k.mail} aria-label={"E-Mail an " + k.name}><Mail /></a></Button>}
                </div>
              </div>
            ))}
          </div>
          {!kontaktAuf ? <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setKontaktAuf(true)}><UserPlus />Ansprechpartner hinzufügen</Button> : (
            <form className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3" onSubmit={(e) => { const w = form(e); const neuK = { name: w.name, funktion: w.funktion || null, tel: w.tel || null, mail: w.mail || null }; aendern(() => { l.kontakte.push(neuK) }, kGesperrt(neuK) ? "Achtung: Diese Nummer oder E-Mail steht auf der Sperrliste." : w.name + " hinzugefügt"); setKontaktAuf(false) }}>
              <Feld id="kn" label="Name"><Input id="kn" name="name" required /></Feld>
              <Feld id="kf" label="Funktion"><Input id="kf" name="funktion" /></Feld>
              <Feld id="kt" label="Telefon"><Input id="kt" name="tel" type="tel" /></Feld>
              <Feld id="km" label="E-Mail"><Input id="km" name="mail" type="email" /></Feld>
              <div className="col-span-2 flex gap-2"><Button type="submit" size="sm">Hinzufügen</Button><Button type="button" variant="ghost" size="sm" onClick={() => setKontaktAuf(false)}>Abbrechen</Button></div>
            </form>
          )}
        </Abschnitt>

        <Abschnitt titel="Verlauf">
          <form className="flex gap-2" onSubmit={(e) => { const w = form(e); if (!w.text) return; aendern(() => M.verlauf(l, ui.ich, "notiz", w.text), "Notiert"); e.currentTarget.reset() }}>
            <Input name="text" placeholder="Notiz: Was ist passiert?" aria-label="Notiz" required /><Button type="submit" size="sm" className="h-9">Notieren</Button>
          </form>
          <ol className="relative space-y-4 border-l pl-4">
            {l.verlauf.slice().reverse().map((e: any, i: number) => (
              <li key={i} className="relative">
                <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-muted-foreground/60" />
                <div className="flex items-baseline justify-between gap-2"><span className="text-sm font-medium">{e.titel}</span><span className="font-mono text-xs text-muted-foreground tabular">{M.dKurz(e.datum)}</span></div>
                {e.text && <div className="text-sm text-muted-foreground">{e.text}</div>}
                <div className="text-xs text-muted-foreground">{M.person(e.wer)?.name}</div>
              </li>
            ))}
            {l.verlauf.length === 0 && <li className="text-sm text-muted-foreground">Noch kein Eintrag.</li>}
          </ol>
        </Abschnitt>

        {gf && l.name !== "[gelöscht]" && (
          <Abschnitt titel="Datenschutz">
            {!loeschAuf ? <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setLoeschAuf(true)}><Trash2 />Daten auf Anfrage löschen</Button> : (
              <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm">Name, Adresse, Ansprechpartner, Fotos und Notizen werden unwiderruflich überschrieben. Zahlen für Umsatz und Provision bleiben ohne Namen erhalten.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" onClick={async () => {
                    try {
                      if (ui.echt) await anonymisieren("lead", l.id, "Löschung auf Anfrage")
                      l.kontakte.forEach((k: any) => Object.assign(k, { name: "[gelöscht]", funktion: null, tel: null, mail: null, notiz: null }))
                      Object.assign(l, { name: "[gelöscht]", adresse: null, felder: {}, fotos: [], uebergabe: null, erfasst: null, geo: null, next: null })
                      if (l.stufe !== "gewonnen") { l.stufe = "verloren"; l.verlustgrund = l.verlustgrund || "Löschung auf Anfrage" }
                      l.verlauf.forEach((v: any) => { v.text = null })
                      neuZeichnen(); setLoeschAuf(false); toast("Daten gelöscht")
                    } catch (e: any) { toast(e.message) }
                  }}><Trash2 />Endgültig löschen</Button>
                  <Button size="sm" variant="ghost" onClick={() => setLoeschAuf(false)}>Abbrechen</Button>
                </div>
              </div>
            )}
          </Abschnitt>
        )}
      </div>
    </>
  )
}

function Fotos({ pfade }: { pfade: string[] }) {
  const [urls, setUrls] = React.useState<string[]>(() => pfade.map((p) => (p.startsWith("data:") ? p : "")))
  React.useEffect(() => { let ok = true; fotoUrls(pfade).then((u) => ok && setUrls(u)); return () => { ok = false } }, [pfade.join("|")])
  return <>{urls.map((u, i) => u ? <img key={i} src={u} alt={"Foto " + (i + 1)} className="h-24 w-32 shrink-0 rounded-md object-cover" /> : <div key={i} className="h-24 w-32 shrink-0 animate-pulse rounded-md bg-muted" />)}</>
}
