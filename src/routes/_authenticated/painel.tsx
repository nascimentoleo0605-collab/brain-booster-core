import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Desempenho — Caderno" }, { name: "description", content: "Seu desempenho por matéria." }] }),
  component: Painel,
});

function Painel() {
  const { user } = Route.useRouteContext();
  const { data, isLoading } = useQuery({
    queryKey: ["attempts", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attempts")
        .select("is_correct, questions(subject)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  const bySubject = new Map<string, { acertos: number; total: number }>();
  (data ?? []).forEach((a: any) => {
    const s = a.questions?.subject ?? "—";
    const cur = bySubject.get(s) ?? { acertos: 0, total: 0 };
    cur.total++;
    if (a.is_correct) cur.acertos++;
    bySubject.set(s, cur);
  });
  const chart = [...bySubject.entries()].map(([materia, v]) => ({
    materia,
    percentual: Math.round((v.acertos / v.total) * 100),
    ...v,
  }));
  const total = data?.length ?? 0;
  const acertos = (data ?? []).filter((a) => a.is_correct).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Seu desempenho</h1>
          <p className="text-muted-foreground">Percentual de acertos por matéria.</p>
        </div>
        <Button asChild><Link to="/estudar">Estudar agora</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Respondidas" value={total} />
        <Stat label="Acertos" value={acertos} />
        <Stat label="Aproveitamento" value={total ? `${Math.round((acertos / total) * 100)}%` : "—"} />
      </div>
      <div className="rounded-xl border bg-card p-6">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : chart.length === 0 ? (
          <p className="text-muted-foreground">Responda algumas questões para ver seu gráfico.</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="materia" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis domain={[0, 100]} unit="%" stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip formatter={(v: any, _n, p: any) => [`${v}% (${p.payload.acertos}/${p.payload.total})`, "Acertos"]} />
                <Bar dataKey="percentual" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value}</p>
    </div>
  );
}
