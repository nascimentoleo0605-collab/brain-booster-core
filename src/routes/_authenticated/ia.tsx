import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleX, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateAiQuiz } from "@/lib/ai-quiz.functions";
import { loadQuestionBank } from "@/lib/question-bank";

export const Route = createFileRoute("/_authenticated/ia")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "MEUCBFPM IA | Questões inéditas" },
    { name: "description", content: "Gere 10 questões inéditas por IA sobre o assunto que você escolher." },
    { property: "og:title", content: "MEUCBFPM IA | Questões inéditas" },
    { property: "og:description", content: "Gere 10 questões inéditas por IA sobre o assunto que você escolher." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: IaPage,
});

type Q = Awaited<ReturnType<typeof generateAiQuiz>>[number];
const ALL = "__all__";

function IaPage() {
  const generate = useServerFn(generateAiQuiz);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState(ALL);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const { data: cls = [] } = useQuery({
    queryKey: ["questions", "summary-classifications"],
    queryFn: () => loadQuestionBank<{ subject: string; topic: string }>((f, t) => supabase.from("questions").select("subject, topic").order("created_at").range(f, t)),
  });
  const subjects = useMemo(() => [...new Set(cls.map((c) => c.subject?.trim()).filter(Boolean))].sort(), [cls]);
  const topics = useMemo(() => [...new Set(cls.filter((c) => c.subject === subject).map((c) => c.topic?.trim()).filter(Boolean))].sort(), [cls, subject]);
  const done = Object.keys(answers).length;
  const right = questions.filter((q, i) => answers[i] === q.correct_index).length;

  async function run() {
    if (!subject) return toast.error("Escolha uma matéria.");
    setLoading(true); setQuestions([]); setAnswers({});
    try { setQuestions(await generate({ data: { subject, topic: topic === ALL ? null : topic } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível gerar as questões."); }
    finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Questões inéditas</p>
        <h1 className="font-serif text-2xl font-semibold">MEUCBFPM IA</h1>
        <p className="text-sm text-muted-foreground">Escolha a matéria e o assunto: a IA cria 10 questões novas com base no banco.</p>
      </header>
      <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5"><Label>Matéria</Label>
          <Select value={subject} onValueChange={(v) => { setSubject(v); setTopic(ALL); }}>
            <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1.5"><Label>Assunto</Label>
          <Select value={topic} onValueChange={setTopic} disabled={!subject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos os assuntos</SelectItem>{topics.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select></div>
        <Button onClick={run} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {loading ? "Gerando..." : "Gerar 10 questões"}</Button>
      </div>
      {loading && <p className="animate-pulse text-center text-sm text-muted-foreground">A IA está criando suas questões. Isso pode levar até um minuto...</p>}
      {questions.length > 0 && (
        <p className="text-sm text-muted-foreground">Respondidas {done}/10 · Acertos <span className="font-semibold text-chart-2">{right}</span></p>
      )}
      {questions.map((q, i) => {
        const sel = answers[i];
        const answered = sel !== undefined;
        const ok = sel === q.correct_index;
        return (
          <article key={q.id} className={`animate-rise-in space-y-3 rounded-lg border bg-card p-4 ${answered ? (ok ? "study-correct" : "study-wrong") : ""}`}>
            <p className="text-xs text-muted-foreground">Questão {i + 1} · {q.topic}</p>
            <p className="font-medium">{q.statement}</p>
            <div className="space-y-2">
              {q.options.map((o, oi) => {
                const cls = !answered ? "hover:border-primary" : oi === q.correct_index ? "study-option-correct border-chart-2 bg-chart-2/10" : oi === sel ? "study-option-wrong border-destructive bg-destructive/10" : "opacity-60";
                return <button key={oi} disabled={answered} onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))} className={`flex w-full gap-2 rounded-md border p-3 text-left text-sm transition-all ${cls}`}><span className="font-semibold">{String.fromCharCode(65 + oi)})</span>{o}</button>;
              })}
            </div>
            {answered && (
              <div className="animate-answer-in space-y-1 text-sm">
                <p className={`flex items-center gap-2 font-semibold ${ok ? "text-chart-2" : "text-destructive"}`}>
                  {ok ? <CheckCircle2 className="study-result-icon size-4" /> : <CircleX className="study-result-icon size-4" />}
                  {ok ? "Mandou bem! Você acertou." : `Quase lá! A correta é a ${String.fromCharCode(65 + q.correct_index)}.`}
                </p>
                {!ok && <p className="text-muted-foreground">{q.explanation}</p>}
              </div>
            )}
          </article>
        );
      })}
      {done === 10 && questions.length === 10 && (
        <div className="animate-answer-in rounded-lg border bg-card p-4 text-center">
          <p className="font-serif text-xl font-semibold">Você acertou {right} de 10</p>
          <Button className="mt-3" onClick={run}><RotateCcw /> Gerar novas questões</Button>
        </div>
      )}
    </div>
  );
}
