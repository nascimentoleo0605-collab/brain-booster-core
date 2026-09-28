import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/materias")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Matérias | MEUCBFPM" },
    { name: "description", content: "Veja seu aproveitamento por matéria no MEUCBFPM." },
    { property: "og:title", content: "Matérias | MEUCBFPM" },
    { property: "og:description", content: "Veja seu aproveitamento por matéria no MEUCBFPM." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Materias,
});

function Materias() {
  const { user } = Route.useRouteContext();
  const { data: questions = [], error: questionsError } = useQuery({
    queryKey: ["questions", "subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("id, subject, topic");
      if (error) throw error;
      return data;
    },
  });
  const { data: attempts = [], error: attemptsError } = useQuery({
    queryKey: ["subject-attempts", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attempts").select("question_id, is_correct, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const latest = new Map<string, boolean>();
  attempts.forEach((attempt) => { if (!latest.has(attempt.question_id)) latest.set(attempt.question_id, attempt.is_correct); });
  const subjects = [...new Set(questions.map((question) => question.subject))].sort();
  return <div className="space-y-6">
    <h1 className="font-serif text-2xl font-semibold">Matérias</h1>
    {(questionsError || attemptsError) && <p role="alert" className="text-destructive">Não foi possível carregar as matérias.</p>}
    {!questionsError && subjects.length === 0 && <p className="text-muted-foreground">Nenhuma matéria cadastrada.</p>}
    <div className="grid gap-4 md:grid-cols-2">{subjects.map((subject) => {
      const own = questions.filter((question) => question.subject === subject);
      const answered = own.filter((question) => latest.has(question.id));
      const correct = answered.filter((question) => latest.get(question.id)).length;
      const percentage = answered.length ? Math.round(correct / answered.length * 100) : 0;
      return <div key={subject} className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4"><h2 className="min-w-0 break-words font-serif text-lg font-semibold">{subject}</h2><strong className="text-xl tabular-nums text-chart-2">{answered.length ? `${percentage}%` : "—"}</strong></div>
        <p className="mt-1 text-sm text-muted-foreground">{correct} {correct === 1 ? "acerto" : "acertos"} · {answered.length} {answered.length === 1 ? "resolvida" : "resolvidas"} · {own.length} questões</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-chart-2" style={{ width: `${percentage}%` }} /></div>
        <div className="mt-4 flex flex-wrap gap-1">{[...new Set(own.map((question) => question.topic).filter(Boolean))].map((topic) => <span key={topic} className="rounded border px-2 py-1 text-xs text-muted-foreground">{topic}</span>)}</div>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/estudar" search={{ subject }}>Estudar</Link>
        </Button>
      </div>;
    })}</div>
  </div>;
}