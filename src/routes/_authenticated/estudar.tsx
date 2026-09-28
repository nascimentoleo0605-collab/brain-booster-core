import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, Flame, X } from "lucide-react";
import { QuestionImage } from "@/components/QuestionImage";

export const Route = createFileRoute("/_authenticated/estudar")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { subject: string | undefined } => ({
    subject: typeof search["subject"] === "string" ? search["subject"] : undefined,
  }),
  head: () => ({ meta: [
    { title: "Estudar | Caderno de Questões — pratique, revise e evolua" }, { name: "description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Resolva sua próxima questão." },
    { property: "og:title", content: "Estudar | Caderno de Questões — pratique, revise e evolua" }, { property: "og:description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Resolva sua próxima questão." },
    { name: "robots", content: "noindex, nofollow" },
  ], links: [{ rel: "canonical", href: "https://stonehawk.com.br/estudar" }] }),
  component: Estudar,
});

type Q = { id: string; subject: string; topic: string; statement: string; options: string[]; correct_index: number; explanation: string; image_path: string | null };
type Attempt = { id: string; question_id: string; is_correct: boolean; created_at: string };
const ALL = "__all";
const letters = "ABCDEFGHIJ";

function Estudar() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const { data: questionData, isLoading } = useQuery({
    queryKey: ["questions", "study", "complete"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, subject, topic, statement, options, correct_index, explanation, image_path")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((question) => ({
        ...question,
        subject: question.subject ?? "Sem matéria",
        topic: question.topic ?? "",
        statement: question.statement ?? "",
        options: Array.isArray(question.options)
          ? question.options.filter((option): option is string => typeof option === "string")
          : [],
        explanation: question.explanation ?? "",
        image_path: question.image_path ?? null,
      })) as Q[];
    },
  });
  const questions = Array.isArray(questionData) ? questionData : [];
  const [subject, setSubject] = useState(search.subject ?? ALL);
  const [topic, setTopic] = useState(ALL);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewingQuestionId, setReviewingQuestionId] = useState<string | null>(null);
  const { data: attempts = [] } = useQuery({
    queryKey: ["study-attempts", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attempts").select("id, question_id, is_correct, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Attempt[];
    },
  });
  const latest = new Map<string, Attempt>();
  attempts.forEach((attempt) => { if (!latest.has(attempt.question_id)) latest.set(attempt.question_id, attempt); });
  let streak = 0;
  for (const attempt of attempts) { if (!attempt.is_correct) break; streak++; }

  const subjects = useMemo(() => [...new Set(questions.map((q) => q.subject))].sort(), [questions]);
  const topics = useMemo(
    () => [...new Set(questions.filter((q) => subject === ALL || q.subject === subject).map((q) => q.topic).filter(Boolean))].sort(),
    [questions, subject],
  );
  const filtered = questions.filter((q) => (subject === ALL || q.subject === subject) && (topic === ALL || q.topic === topic) && (!onlyWrong || latest.get(q.id)?.is_correct === false || (answered && q.id === reviewingQuestionId)));
  const q = filtered[idx % Math.max(filtered.length, 1)];
  const last = q ? latest.get(q.id) : undefined;
  const displayedLastCorrect = answered && q?.id === reviewingQuestionId && selected !== null
    ? selected === q.correct_index
    : last?.is_correct;

  const reset = () => { setSelected(null); setAnswered(false); setReviewingQuestionId(null); };
  const answer = async () => {
    if (selected === null || !q) return;
    setSaving(true);
    const { error } = await supabase.from("attempts").insert({ question_id: q.id, selected_index: selected, is_correct: false });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar sua resposta."); return; }
    setReviewingQuestionId(q.id);
    setAnswered(true);
    qc.invalidateQueries({ queryKey: ["attempts"] });
    qc.invalidateQueries({ queryKey: ["study-attempts", user.id] });
    qc.invalidateQueries({ queryKey: ["ranking"] });
    qc.invalidateQueries({ queryKey: ["subject-attempts", user.id] });
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
        <Button type="button" variant={onlyWrong ? "default" : "outline"} onClick={() => { setOnlyWrong(!onlyWrong); setIdx(0); reset(); }}>Refazer erros</Button>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground" aria-label={`Sequência de ${streak} acertos`}>
        <Flame className={streak > 3 ? "text-chart-3" : ""} size={18} />
             <span>{streak > 3 ? `Sequência flamejante · ${streak}` : `${streak} ${streak === 1 ? "acerto seguido" : "acertos seguidos"}`}</span>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : !q ? (
        <div className="rounded-lg border bg-card p-8 text-muted-foreground">{onlyWrong ? "Nenhuma questão errada para refazer." : "Nenhuma questão encontrada."}</div>
      ) : (
        <div className="rounded-xl border bg-card p-6 md:p-8">
          <div className="mb-4 flex justify-between text-sm text-muted-foreground">
            <span>{q.subject}{q.topic && ` · ${q.topic}`}</span>
            <span>{(idx % filtered.length) + 1} / {filtered.length}</span>
          </div>
           {(last || answered) && <div className={`mb-4 inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm ${displayedLastCorrect ? "border-chart-2/50 bg-chart-2/10 text-chart-2" : "border-destructive/50 bg-destructive/10 text-destructive"}`}>
             {displayedLastCorrect ? <Check size={16} /> : <X size={16} />}
             Última tentativa: {displayedLastCorrect ? "acertou" : "errou"}
          </div>}
          <p className="whitespace-pre-wrap text-lg leading-relaxed">{q.statement}</p>
          <QuestionImage path={q.image_path} />
          <div className="mt-6 space-y-2">
            {q.options.length < 2 ? (
              <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                Esta questão está sem alternativas válidas. Peça ao administrador para revisá-la.
              </p>
            ) : q.options.map((opt, i) => {
              const isCorrect = i === q.correct_index;
              return (
                <Button
                  type="button"
                  variant="outline"
                  key={i}
                  disabled={answered}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "!h-auto min-h-12 w-full !justify-start whitespace-normal p-3 text-left",
                    !answered && selected === i && "border-primary bg-muted",
                    !answered && "hover:bg-muted",
                    answered && isCorrect && "border-chart-2 bg-chart-2/10 text-chart-2",
                    answered && selected === i && !isCorrect && "border-destructive bg-destructive/10",
                  )}
                >
                  <span className="font-semibold">{letters[i]})</span>
                  <span>{opt}</span>
                </Button>
              );
            })}
          </div>
          {answered && (
             <div role="status" className={cn("mt-6 rounded-lg border p-4", selected === q.correct_index ? "border-chart-2/50 bg-chart-2/10" : "border-destructive/50 bg-destructive/10")}>
               <p className={cn("font-semibold", selected === q.correct_index ? "text-chart-2" : "text-destructive")}>
                 {selected === q.correct_index ? "Você acertou!" : `Você errou. Resposta correta: ${letters[q.correct_index]}) ${q.options[q.correct_index]}`}
              </p>
              {q.explanation && <p className="mt-2 whitespace-pre-wrap text-sm">{q.explanation}</p>}
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            {!answered ? (
               <Button onClick={answer} disabled={q.options.length < 2 || selected === null || saving}>{saving ? "Salvando…" : "Responder"}</Button>
            ) : (
               <Button onClick={() => { if (!onlyWrong || selected !== q.correct_index) setIdx((i) => i + 1); reset(); }}>Próxima</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
