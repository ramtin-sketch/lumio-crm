import * as React from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import { TrendingDown, TrendingUp } from "lucide-react"

export function PersonAvatar({ id, className }: { id: string | null; className?: string }) {
  const p = id ? M.person(id) : null
  if (!p) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className={cn("size-6 text-[10px]", className)}>
          <AvatarFallback className={cn("font-medium", p.rolle === "gf" ? "bg-primary text-primary-foreground" : "bg-muted")}>{p.kurz}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{p.voll}</TooltipContent>
    </Tooltip>
  )
}

export function BereichBadge({ b }: { b: string }) {
  if (b === "werbung") return <Badge variant="outline" className="border-transparent bg-cobalt/10 text-cobalt">Werbemandat</Badge>
  if (b === "bildung") return <Badge variant="outline" className="border-transparent bg-chart-4/15 text-chart-4">Weiterbildung</Badge>
  return <Badge variant="outline" className="border-transparent bg-chart-2/15 text-chart-2">Standortakquise</Badge>
}

export function StufeBadge({ l }: { l: any }) {
  const s = M.stufeVon(l)
  if (l.stufe === "gewonnen") return <Badge variant="outline" className="border-transparent bg-ok/15 text-ok">{s.name}</Badge>
  if (l.stufe === "verloren") return <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">{s.name}</Badge>
  return <Badge variant="secondary">{s.name}</Badge>
}

export function StatusBadge({ s }: { s: string }) {
  const cls = s === "bezahlt" ? "bg-ok/15 text-ok" : s === "abgerechnet" ? "bg-warn/15 text-warn" : ""
  return <Badge variant={s === "offen" ? "secondary" : "outline"} className={cn("capitalize", cls && "border-transparent " + cls)}>{s}</Badge>
}

export function Trend({ wert }: { wert: number | null }) {
  if (wert === null || !isFinite(wert)) return null
  const hoch = wert >= 0
  return (
    <Badge variant="outline" className={cn("gap-1", hoch ? "text-ok" : "text-destructive")}>
      {hoch ? <TrendingUp /> : <TrendingDown />}{hoch ? "+" : ""}{Math.round(wert)} %
    </Badge>
  )
}

export function Kpi({ titel, wert, trend, fuss, zusatz, kritisch }: { titel: string; wert: React.ReactNode; trend?: number | null; fuss?: React.ReactNode; zusatz?: React.ReactNode; kritisch?: boolean }) {
  return (
    <Card className="@container/card gap-3 bg-gradient-to-t from-primary/[0.03] to-card shadow-xs dark:from-primary/[0.04]">
      <CardHeader>
        <CardDescription>{titel}</CardDescription>
        <CardTitle className={cn("text-2xl font-semibold whitespace-nowrap tabular @[290px]/card:text-3xl", kritisch && "text-destructive")}>{wert}</CardTitle>
        {trend !== undefined && <CardAction><Trend wert={trend} /></CardAction>}
      </CardHeader>
      {(fuss || zusatz) && (
        <CardFooter className="flex-col items-start gap-0.5 text-sm">
          {fuss && <div className="font-medium">{fuss}</div>}
          {zusatz && <div className="text-muted-foreground">{zusatz}</div>}
        </CardFooter>
      )}
    </Card>
  )
}

/* Ziel-Balken für Handelsvertreter: Strich bei 2.000 €, Farbe nach Prognose */
export function ZielBar({ betrag, prognose, className }: { betrag: number; prognose?: number; className?: string }) {
  const pct = Math.min(100, (betrag / M.ZIEL_HV.max) * 100)
  const basis = prognose ?? betrag
  const farbe = basis >= M.ZIEL_HV.min ? "bg-ok" : basis >= M.ZIEL_HV.min * 0.8 ? "bg-warn" : "bg-destructive"
  return (
    <div className={cn("relative h-2 w-full min-w-24 overflow-hidden rounded-full bg-muted", className)} title={`${M.eur(betrag)} von ${M.eur(M.ZIEL_HV.min)}–${M.eur(M.ZIEL_HV.max)}`}>
      <div className={cn("absolute inset-y-0 left-0 rounded-full", farbe)} style={{ width: pct + "%" }} />
      <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: (M.ZIEL_HV.min / M.ZIEL_HV.max) * 100 + "%" }} />
    </div>
  )
}

export function Seitenkopf({ titel, text, children }: { titel: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
        {text && <p className="text-muted-foreground text-sm">{text}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
