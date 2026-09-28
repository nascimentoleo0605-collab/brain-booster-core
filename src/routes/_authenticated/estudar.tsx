import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estudar")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Estudar | Caderno de Questões — pratique, revise e evolua" }, { name: "description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Resolva sua próxima questão." },
    { property: "og:title", content: "Estudar | Caderno de Questões — pratique, revise e evolua" }, { property: "og:description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Resolva sua próxima questão." },
    { name: "robots", content: "noindex, nofollow" },
  ], links: [{ rel: "canonical", href: "https://stonehawk.com.br/estudar" }] }),
  component: Estudar,
});

type Q = { id: string; subject: string; topic: string; statement: string; options: string[]; correct_index: number; explanation: string };
const ALL = "__all";
const letters = "ABCDEFGHIJ";

function Estudar() {
  const qc = useQueryClient();
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["questions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("*").order("created_at");
      if (error) throw error;
      return data as unknown as Q[];
    },
  });
  const [subject, setSubject] = useState(ALL);
  const [topic, setTopic] = useState(ALL);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  const subjects = useMemo(() => [...new Set(questions.map((q) => q.subject))].sort(), [questions]);
  const topics = useMemo(
    () => [...new Set(questions.filter((q) => subject === ALL || q.subject === subject).map((q) => q.topic).filter(Boolean))].sort(),
    [questions, subject],
  );
  const filtered = questions.filter((q) => (subject === ALL || q.subject === subject) && (topic === ALL || q.topic === topic));
  const q = filtered[idx % Math.max(filtered.length, 1)];

  const reset = () => { setSelected(null); setAnswered(false); };
  const answer = async () => {
    if (selected === null || !q) return;
    setAnswered(true);
    const { error } = await supabase.from("attempts").insert({ question_id: q.id, selected_index: selected, is_correct: false });
    if (error) toast.error("Não foi possível salvar sua resposta.");
    qc.invalidateQueries({ queryKey: ["attempts"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto font-serif text-3xl">Estudar</h1>
        <Select value={subject} onValueChange={(v) => { setSubject(v); setTopic(ALL); setIdx(0); reset(); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Matéria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as matérias</SelectItem>
            {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={topic} onValueChange={(v) => { setTopic(v); setIdx(0); reset(); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Assunto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os assuntos</SelectItem>
            {topics.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : !q ? (
        <div className="rounded-xl border bg-card p-8 text-muted-foreground">Nenhuma questão encontrada.</div>
      ) : (
        <div className="rounded-xl border bg-card p-6 md:p-8">
          <div className="mb-4 flex justify-between text-sm text-muted-foreground">
            <span>{q.subject}{q.topic && ` · ${q.topic}`}</span>
            <span>{(idx % filtered.length) + 1} / {filtered.length}</span>
          </div>
          <p className="whitespace-pre-wrap text-lg leading-relaxed">{q.statement}</p>
          <div className="mt-6 space-y-2">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correct_index;
              return (
                <button
                  key={i}
                  disabled={answered}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    !answered && selected === i && "border-primary bg-muted",
                    !answered && "hover:bg-muted",
                    answered && isCorrect && "border-primary bg-primary/10",
                    answered && selected === i && !isCorrect && "border-destructive bg-destructive/10",
                  )}
                >
                  <span className="font-semibold">{letters[i]})</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="mt-6 rounded-lg bg-muted p-4">
              <p className={cn("font-semibold", selected === q.correct_index ? "text-primary" : "text-destructive")}>
                {selected === q.correct_index ? "Você acertou!" : `Resposta correta: ${letters[q.correct_index]}`}
              </p>
              {q.explanation && <p className="mt-2 whitespace-pre-wrap text-sm">{q.explanation}</p>}
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            {!answered ? (
              <Button onClick={answer} disabled={selected === null}>Responder</Button>
            ) : (
              <Button onClick={() => { setIdx((i) => i + 1); reset(); }}>Próxima</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
