import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { getRanking } from "@/lib/ranking.functions";

export const Route = createFileRoute("/_authenticated/ranking")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Ranking | Caderno de Questões — pratique, revise e evolua" },
    { name: "description", content: "Acompanhe o ranking de acertos do Caderno de Questões." },
    { property: "og:title", content: "Ranking | Caderno de Questões — pratique, revise e evolua" },
    { property: "og:description", content: "Acompanhe o ranking de acertos do Caderno de Questões." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Ranking,
});

function Ranking() {
  const { user } = Route.useRouteContext();
  const fetchRanking = useServerFn(getRanking);
  const { data = [], isPending, error } = useQuery({ queryKey: ["ranking"], queryFn: () => fetchRanking() });
  return <div className="space-y-6">
    <div className="flex items-center gap-3"><Trophy className="text-chart-3" /><h1 className="font-serif text-2xl font-semibold">Ranking</h1></div>
    {isPending && <p className="text-muted-foreground">Carregando…</p>}
    {error && <p role="alert" className="text-destructive">Não foi possível carregar o ranking.</p>}
    <div className="divide-y rounded-lg border">{data.map((entry, index) => <div key={entry.id} className={`flex items-center gap-4 px-4 py-4 ${entry.id === user.id ? "bg-primary/10" : ""}`}>
      <span className="w-8 text-center font-serif text-lg text-muted-foreground">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate">{entry.name}{entry.id === user.id && <span className="ml-2 text-xs text-muted-foreground">Você</span>}</span>
      <strong className="tabular-nums text-chart-2">{entry.correct} {entry.correct === 1 ? "acerto" : "acertos"}</strong>
    </div>)}</div>
  </div>;
}