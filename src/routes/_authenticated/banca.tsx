import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Pause, Play, PhoneOff, Gavel, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { loadQuestionBank } from "@/lib/question-bank";
import { bancaTurn } from "@/lib/banca.functions";

export const Route = createFileRoute("/_authenticated/banca")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Banca Examinadora | MEUCBFPM" },
    { name: "description", content: "Treine arguição oral por voz com a examinadora do MEUCBFPM." },
    { property: "og:title", content: "Banca Examinadora | MEUCBFPM" },
    { property: "og:description", content: "Treine arguição oral por voz com a examinadora do MEUCBFPM." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Banca,
});

const ALL = "__all__";
const SESSION_SECONDS = 600;
const IDLE_MS = 60_000;
type Turn = { role: "banca" | "aluno"; text: string };
type Status = "idle" | "thinking" | "speaking" | "listening" | "paused" | "ended";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

function pickFemaleVoice() {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("pt"));
  const female = /(francisca|luciana|maria|vit[oó]ria|camila|fernanda|thalita|female|feminina|google português)/i;
  return voices.find((v) => v.lang === "pt-BR" && female.test(v.name))
    ?? voices.find((v) => female.test(v.name))
    ?? voices.find((v) => v.lang === "pt-BR")
    ?? voices[0];
}

function Banca() {
  const turn = useServerFn(bancaTurn);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState(ALL);
  const [status, setStatus] = useState<Status>("idle");
  const [history, setHistory] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [muted, setMuted] = useState(false);
  const [remaining, setRemaining] = useState(SESSION_SECONDS);
  const [supported, setSupported] = useState(true);

  const historyRef = useRef<Turn[]>([]);
  const statusRef = useRef<Status>("idle");
  const mutedRef = useRef(false);
  const recRef = useRef<AnyRecognition>(null);
  const finalRef = useRef("");
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleStage = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const setS = (s: Status) => { statusRef.current = s; setStatus(s); };

  const { data: rows = [] } = useQuery({
    queryKey: ["questions", "summary-classifications"],
    queryFn: () => loadQuestionBank<{ subject: string; topic: string }>((from, to) =>
      supabase.from("questions").select("subject, topic").order("created_at").range(from, to)),
  });
  const subjects = useMemo(() => [...new Set(rows.map((r) => r.subject.trim()).filter(Boolean))].sort(), [rows]);
  const topics = useMemo(() => [...new Set(rows.filter((r) => r.subject === subject).map((r) => r.topic.trim()).filter(Boolean))].sort(), [rows, subject]);

  useEffect(() => {
    const SR = (window as AnyRecognition).SpeechRecognition || (window as AnyRecognition).webkitSpeechRecognition;
    if (!SR || !("speechSynthesis" in window)) setSupported(false);
    window.speechSynthesis?.getVoices();
    return () => { cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [history, interim]);

  // Session countdown (frozen while paused)
  useEffect(() => {
    if (status === "idle" || status === "ended" || status === "paused") return;
    const id = setInterval(() => setRemaining((r) => {
      if (r <= 1) { clearInterval(id); void finish(); return 0; }
      return r - 1;
    }), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === "idle" || status === "ended" || status === "paused"]);

  function clearIdle() { if (idleTimer.current) clearTimeout(idleTimer.current); idleTimer.current = null; }
  function armIdle() {
    clearIdle();
    idleTimer.current = setTimeout(() => {
      if (statusRef.current !== "listening") return;
      if (idleStage.current === 0) { idleStage.current = 1; void ask("idle"); }
      else void finish("Sessão encerrada por falta de resposta.");
    }, IDLE_MS);
  }

  function stopListening() {
    try { recRef.current?.abort(); } catch { /* noop */ }
    recRef.current = null;
  }

  function cleanup() { clearIdle(); stopListening(); window.speechSynthesis?.cancel(); }

  function push(t: Turn) { historyRef.current = [...historyRef.current, t]; setHistory(historyRef.current); }

  function speak(text: string, after: () => void) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickFemaleVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "pt-BR";
    u.rate = 1.02;
    u.pitch = 1.1;
    u.onend = after;
    u.onerror = after;
    setS("speaking");
    window.speechSynthesis.speak(u);
  }

  function listen() {
    if (statusRef.current === "ended" || statusRef.current === "paused") return;
    setS("listening");
    armIdle();
    if (mutedRef.current) return;
    const SR = (window as AnyRecognition).SpeechRecognition || (window as AnyRecognition).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = "";
    let silence: ReturnType<typeof setTimeout> | null = null;
    rec.onresult = (e: AnyRecognition) => {
      armIdle();
      idleStage.current = 0;
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + " ";
        else live += r[0].transcript;
      }
      setInterim((finalRef.current + live).trim());
      if (silence) clearTimeout(silence);
      silence = setTimeout(() => {
        const said = (finalRef.current + live).trim();
        if (said) { stopListening(); setInterim(""); push({ role: "aluno", text: said }); void ask("answer"); }
      }, 2200);
    };
    rec.onend = () => {
      if (recRef.current === rec && statusRef.current === "listening" && !mutedRef.current) {
        try { rec.start(); } catch { /* noop */ }
      }
    };
    rec.onerror = (e: AnyRecognition) => {
      if (e.error === "not-allowed") { toast.error("Permita o uso do microfone para conversar com a banca."); setMuted(true); mutedRef.current = true; }
    };
    recRef.current = rec;
    try { rec.start(); } catch { /* noop */ }
  }

  async function ask(event: "start" | "answer" | "idle" | "end") {
    clearIdle();
    stopListening();
    setS("thinking");
    try {
      const res = await turn({ data: { subject, topic: topic === ALL ? null : topic, history: historyRef.current.slice(-12), event } });
      if (statusRef.current === "ended" && event !== "end") return;
      push({ role: "banca", text: res.text });
      speak(res.text, () => { if (event === "end") setS("ended"); else listen(); });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Estamos em atualizações no momento. Tente novamente em breve.");
      cleanup();
      setS("ended");
    }
  }

  async function finish(note?: string) {
    if (statusRef.current === "ended") return;
    cleanup();
    if (note) toast.info(note);
    if (historyRef.current.some((t) => t.role === "aluno")) await ask("end");
    else setS("ended");
    statusRef.current = "ended";
  }

  function start() {
    if (!subject) return toast.error("Escolha uma matéria.");
    historyRef.current = []; setHistory([]); setRemaining(SESSION_SECONDS); idleStage.current = 0;
    setMuted(false); mutedRef.current = false;
    void ask("start");
  }

  function toggleMute() {
    const m = !mutedRef.current; mutedRef.current = m; setMuted(m);
    if (m) stopListening(); else if (statusRef.current === "listening") listen();
  }

  function togglePause() {
    if (statusRef.current === "paused") { listen(); return; }
    cleanup(); setInterim(""); setS("paused");
  }

  const active = status !== "idle" && status !== "ended";
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><Gavel className="text-primary" /> Banca Examinadora</h1>
        <p className="text-sm text-muted-foreground">Arguição oral por voz. Sessão de até 10 minutos.</p>
      </header>

      {!supported && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">Seu navegador não suporta conversa por voz. Use o Google Chrome ou Edge.</p>
      )}

      {!active && (
        <div className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Matéria</Label>
            <Select value={subject} onValueChange={(v) => { setSubject(v); setTopic(ALL); }}>
              <SelectTrigger><SelectValue placeholder="Escolha a matéria" /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assunto</Label>
            <Select value={topic} onValueChange={setTopic} disabled={!subject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os assuntos</SelectItem>
                {topics.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="sm:col-span-2" onClick={start} disabled={!supported || !subject}>
            {status === "ended" ? "Nova sessão" : "Iniciar Banca"}
          </Button>
        </div>
      )}

      {(active || history.length > 0) && (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{active ? statusLabel(status) : "Sessão encerrada"}</span>
            <span className="font-mono tabular-nums text-primary">{mm}:{ss}</span>
          </div>

          <div className="flex items-center justify-around py-4">
            <div className="flex flex-col items-center gap-2">
              <div className="relative grid h-24 w-24 place-items-center">
                {status === "speaking" && <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                  <span className="absolute -inset-2 animate-pulse rounded-full border-2 border-primary/50" />
                </>}
                {status === "thinking" && <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />}
                <div className={`relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-accent/30 text-3xl transition-transform ${status === "speaking" ? "scale-105" : ""}`}>👩‍⚖️</div>
              </div>
              <span className="text-xs text-muted-foreground">Examinadora</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex h-24 items-center gap-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <span key={i}
                    className={`w-2 rounded-full bg-accent transition-all ${status === "listening" && !muted && interim ? "animate-pulse" : ""}`}
                    style={{ height: status === "listening" && !muted ? (interim ? `${20 + ((i * 37 + interim.length * 13) % 60)}px` : "10px") : "6px", animationDelay: `${i * 90}ms` }} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{muted ? "Microfone mudo" : "Você"}</span>
            </div>
          </div>

          <div ref={scrollRef} className="mt-4 max-h-80 space-y-3 overflow-y-auto">
            {history.map((t, i) => (
              <div key={i} className={`rounded-lg p-3 text-sm ${t.role === "banca" ? "bg-secondary" : "ml-8 bg-primary/10"}`}>
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t.role === "banca" ? "Examinadora" : "Você"}</span>
                {t.text}
              </div>
            ))}
            {interim && <div className="ml-8 rounded-lg bg-primary/5 p-3 text-sm italic text-muted-foreground">{interim}</div>}
          </div>

          {active && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={toggleMute} disabled={status === "paused"}>{muted ? <><MicOff /> Ativar microfone</> : <><Mic /> Mutar</>}</Button>
              <Button variant="outline" onClick={togglePause} disabled={status === "thinking" || status === "speaking"}>{status === "paused" ? <><Play /> Continuar</> : <><Pause /> Pausar para pensar</>}</Button>
              <Button variant="destructive" onClick={() => void finish()}><PhoneOff /> Encerrar</Button>
            </div>
          )}
          {status === "thinking" && <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="h-3 w-3 animate-spin" /> A banca está formulando…</p>}
        </div>
      )}
    </div>
  );
}

function statusLabel(s: Status) {
  return { idle: "", thinking: "A banca está pensando", speaking: "A examinadora está falando", listening: "Sua vez de responder", paused: "Pausado para pensar", ended: "Encerrada" }[s];
}
