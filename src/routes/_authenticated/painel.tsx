import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Line, LineChart,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [
    { title: "Desempenho | Caderno de Questões — pratique, revise e evolua" }, { name: "description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho." },
    { property: "og:title", content: "Desempenho | Caderno de Questões — pratique, revise e evolua" }, { property: "og:description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Painel,
});

const PERIODS: Record<string, { label: string; days: number | null }> = {
  "7": { label: "Últimos 7 dias", days: 7 },
  "30": { label: "Últimos 30 dias", days: 30 },
  "90": { label: "Últimos 90 dias", days: 90 },
  all: { label: "Todo o período", days: null },
};
const ALL = "__all";

type A = { is_correct: boolean; created_at: string; questions: { subject: string; topic: string } | null };

function group(rows: A[], key: (a: A) => string) {
  const m = new Map<string, { acertos: number; erros: number }>();
  rows.forEach((a) => {
    const k = key(a);
    const c = m.get(k) ?? { acertos: 0, erros: 0 };
    a.is_correct ? c.acertos++ : c.erros++;
    m.set(k, c);
  });
  return [...m.entries()].map(([nome, v]) => ({
    nome, ...v, total: v.acertos + v.erros,
    percentual: Math.round((v.acertos / (v.acertos + v.erros)) * 100),
  }));
}

function Painel() {
  const { user } = Route.useRouteContext();
  const [period, setPeriod] = useState("30");
  const [subject, setSubject] = useState(ALL);

  const { data = [], isLoading } = useQuery({
    queryKey: ["attempts", user.id, period],
    queryFn: async () => {
      let q = supabase.from("attempts").select("is_correct, created_at, questions(subject, topic)").eq("user_id", user.id).order("created_at");
      const days = PERIODS[period]?.days;
      if (days) q = q.gte("created_at", new Date(Date.now() - days * 864e5).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as A[];
    },
  });

  const subjects = useMemo(() => [...new Set(data.map((a) => a.questions?.subject ?? "—"))].sort(), [data]);
  const rows = subject === ALL ? data : data.filter((a) => a.questions?.subject === subject);
  const bySubject = group(data, (a) => a.questions?.subject ?? "—");
  const byTopic = group(rows, (a) => (subject === ALL ? `${a.questions?.subject} · ` : "") + (a.questions?.topic || "Sem assunto"));
  const timeline = group(rows, (a) => a.created_at.slice(0, 10))
    .sort((x, y) => x.nome.localeCompare(y.nome))
    .map((d) => ({ ...d, dia: d.nome.slice(8, 10) + "/" + d.nome.slice(5, 7) }));

  const total = rows.length;
  const acertos = rows.filter((a) => a.is_correct).length;
  const axis = { stroke: "var(--muted-foreground)", fontSize: 12 };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="font-serif text-2xl font-semibold">Seu desempenho</h1>
          <p className="text-muted-foreground">Acertos, erros e evolução.</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PERIODS).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as matérias</SelectItem>
            {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button asChild><Link to="/estudar">Estudar agora</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Respondidas" value={total} />
        <Stat label="Acertos" value={acertos} />
        <Stat label="Erros" value={total - acertos} />
        <Stat label="Aproveitamento" value={total ? `${Math.round((acertos / total) * 100)}%` : "—"} />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : data.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-muted-foreground">Nenhuma resposta neste período. Resolva algumas questões para ver seus gráficos.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Evolução ao longo do tempo" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" {...axis} />
                <YAxis yAxisId="l" allowDecimals={false} {...axis} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%" {...axis} />
                <Tooltip />
                <Legend />
                <Line yAxisId="l" dataKey="acertos" name="Acertos" stroke="var(--chart-1)" strokeWidth={2} />
                <Line yAxisId="l" dataKey="erros" name="Erros" stroke="var(--destructive)" strokeWidth={2} />
                <Line yAxisId="r" dataKey="percentual" name="% acerto" stroke="var(--chart-4)" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Por matéria">
            <Bars data={bySubject} axis={axis} />
          </Card>
          <Card title={subject === ALL ? "Por assunto" : `Assuntos de ${subject}`}>
            <Bars data={byTopic} axis={axis} />
          </Card>
        </div>
      )}
    </div>
  );
}

function Bars({ data, axis }: { data: any[]; axis: any }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} {...axis} />
        <YAxis type="category" dataKey="nome" width={120} {...axis} />
        <Tooltip formatter={(v: any, n: any) => [v, n]} />
        <Legend />
        <Bar dataKey="acertos" name="Acertos" stackId="a" fill="var(--chart-1)" />
        <Bar dataKey="erros" name="Erros" stackId="a" fill="var(--destructive)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border bg-card p-5 ${className}`}>
      <h2 className="mb-4 font-serif text-base font-semibold">{title}</h2>
      <div className="h-72">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold">{value}</p>
    </div>
  );
}
