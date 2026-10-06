import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PersonAvatar } from "@/bits"
import { bump, useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { ArrowRight, CalendarCheck2, CalendarX2, UserCheck } from "lucide-react"

/* Formular beim Termin: Briefing für den Closer und an wen es geht */
export function UebergabeFormular({ l, onFertig, onAbbrechen }: { l: any; onFertig: () => void; onAbbrechen: () => void }) {
  const ui = useUI()
  const ich = M.person(ui.ich)
  const [datum, setDatum] = React.useState(M.tag(1))
  const [zeit, setZeit] = React.useState("10:00")
  const [closer, setCloser] = React.useState(ich.rolle === "gf" ? ui.ich : M.closerVorschlag())
  const [entscheider, setEntscheider] = React.useState("ja")
  const [budget, setBudget] = React.useState("unklar")
  const [bedarf, setBedarf] = React.useState("")
  const [einwaende, setEinwaende] = React.useState<string[]>([])
  const [notiz, setNotiz] = React.useState("")
  const id = (s: string) => s + l.id
  return (
    <form className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-3"
      onSubmit={(e) => { e.preventDefault(); toast(M.protokoll(l, ui.ich, "termin", { datum, zeit, closer, entscheider, budget, bedarf, einwaende, notiz })); bump(); onFertig() }}>
      <div className="flex items-center gap-2 text-sm font-medium"><UserCheck className="size-4" />Termin vereinbaren und übergeben</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5"><Label htmlFor={id("ud")} className="text-xs text-muted-foreground">Datum</Label><Input id={id("ud")} type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required /></div>
        <div className="grid gap-1.5"><Label htmlFor={id("uz")} className="text-xs text-muted-foreground">Uhrzeit</Label><Input id={id("uz")} type="time" value={zeit} onChange={(e) => setZeit(e.target.value)} required /></div>
        <div className="col-span-2 grid gap-1.5 sm:col-span-1"><Label htmlFor={id("uc")} className="text-xs text-muted-foreground">Closer</Label>
          <NativeSelect id={id("uc")} value={closer} onChange={(e) => setCloser(e.target.value)}>
            {M.PERSONEN.filter((p: any) => p.rolle === "gf").map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.id === ui.ich ? p.voll + " (ich selbst)" : p.voll}</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><Label htmlFor={id("ue")} className="text-xs text-muted-foreground">Entscheider erreicht?</Label>
          <NativeSelect id={id("ue")} value={entscheider} onChange={(e) => setEntscheider(e.target.value)}>{M.ENTSCHEIDER.map((x: any) => <NativeSelectOption key={x[0]} value={x[0]}>{x[1]}</NativeSelectOption>)}</NativeSelect>
        </div>
        <div className="grid gap-1.5"><Label htmlFor={id("ub")} className="text-xs text-muted-foreground">Budget</Label>
          <NativeSelect id={id("ub")} value={budget} onChange={(e) => setBudget(e.target.value)}>{M.BUDGETS.map((x: any) => <NativeSelectOption key={x[0]} value={x[0]}>{x[1]}</NativeSelectOption>)}</NativeSelect>
        </div>
      </div>
      <div className="grid gap-1.5"><Label htmlFor={id("un")} className="text-xs text-muted-foreground">Bedarf in einem Satz</Label><Input id={id("un")} value={bedarf} onChange={(e) => setBedarf(e.target.value)} placeholder="Was will der Kunde erreichen?" /></div>
      <div className="grid gap-1.5">
        <span className="text-xs text-muted-foreground">Einwände, die schon kamen</span>
        <ToggleGroup type="multiple" variant="outline" size="sm" value={einwaende} onValueChange={setEinwaende} className="flex flex-wrap">
          {M.EINWAENDE.map((e: string) => <ToggleGroupItem key={e} value={e} className="h-7 flex-none rounded-md! border px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{e}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
      <div className="grid gap-1.5"><Label htmlFor={id("ut")} className="text-xs text-muted-foreground">Hinweis für den Closer</Label><Textarea id={id("ut")} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Was muss der Closer wissen?" className="min-h-16" /></div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm"><ArrowRight />{closer === ui.ich ? "Termin eintragen" : "An " + M.person(closer).name + " übergeben"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onAbbrechen}>Abbrechen</Button>
      </div>
    </form>
  )
}

/* Karte im Lead: was der Setter mitgibt, und nach dem Termin die zwei Knöpfe für den Closer */
export function UebergabeKarte({ l }: { l: any }) {
  const ui = useUI()
  const u = l.uebergabe
  if (!u) return null
  const budget = M.BUDGETS.find((b: any) => b[0] === u.budget)?.[1]
  const ent = M.ENTSCHEIDER.find((b: any) => b[0] === u.entscheider)?.[1]
  const darfErgebnis = l.stufe === "termin" && (ui.ich === u.an || ui.istGF)
  const faellig = u.termin.datum <= M.HEUTE
  const selbst = u.von === u.an
  return (
    <Card className={cn("gap-3 py-4", l.stufe === "termin" && "border-cobalt/40 bg-cobalt/[0.03]")}>
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <PersonAvatar id={u.von} />{!selbst && <><ArrowRight className="size-3.5 text-muted-foreground" /><PersonAvatar id={u.an} /></>}
          <span>{selbst ? "Selbst gesetzt von " + M.person(u.von).name : "Übergabe von " + M.person(u.von).name + " an " + M.person(u.an).name}</span>
        </CardTitle>
        <CardDescription>Termin {M.dKurz(u.termin.datum)}{u.termin.zeit ? " um " + u.termin.zeit : ""} · gesetzt am {M.dKurz(u.datum)}</CardDescription>
        {l.terminStatus === "noshow" && <CardAction><Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">No-Show</Badge></CardAction>}
        {l.terminStatus === "gelaufen" && <CardAction><Badge variant="outline" className="border-transparent bg-ok/15 text-ok">gelaufen</Badge></CardAction>}
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Entscheider</dt><dd className={cn(u.entscheider !== "ja" && "text-warn")}>{ent}</dd>
          <dt className="text-muted-foreground">Budget</dt><dd>{budget}</dd>
          {u.bedarf && <><dt className="text-muted-foreground">Bedarf</dt><dd>{u.bedarf}</dd></>}
          {u.einwaende?.length > 0 && <><dt className="text-muted-foreground">Einwände</dt><dd className="flex flex-wrap gap-1">{u.einwaende.map((e: string) => <Badge key={e} variant="secondary" className="font-normal">{e}</Badge>)}</dd></>}
          {u.notiz && <><dt className="text-muted-foreground">Hinweis</dt><dd>{u.notiz}</dd></>}
        </dl>
        {darfErgebnis && (
          <div className="space-y-2">
            {!faellig && <p className="text-xs text-muted-foreground">Nach dem Termin hier eintragen, wie er gelaufen ist.</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => { toast(M.terminErgebnis(l, ui.ich, "gelaufen")); bump() }}><CalendarCheck2 />Termin gelaufen</Button>
              <Button size="sm" variant="outline" onClick={() => { toast(M.terminErgebnis(l, ui.ich, "noshow")); bump() }}><CalendarX2 />Nicht erschienen</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
