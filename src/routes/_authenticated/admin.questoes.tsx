import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { CsvImport } from "@/components/CsvImport";

export const Route = createFileRoute("/_authenticated/admin/questoes")({
  beforeLoad: ({ context }) => { if (!context.isAdmin) throw redirect({ to: "/painel" }); },
  head: () => ({ meta: [{ title: "Questões — Caderno" }, { name: "description", content: "Gerencie o banco de questões." }] }),
  component: Questoes,
});

type Q = { id: string; subject: string; topic: string; statement: string; options: string[]; correct_index: number; explanation: string };
const empty = { subject: "", topic: "", statement: "", options: ["", "", "", ""], correct_index: 0, explanation: "" };
const letters = "ABCDEFGHIJ";

function Questoes() {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: ["questions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Q[];
    },
  });
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const options = form.options.map((o) => o.trim());
    if (options.some((o) => !o)) { toast.error("Preencha todas as alternativas."); return; }
    const payload = { ...form, options, subject: form.subject.trim(), topic: form.topic.trim() };
    const { error } = editing
      ? await supabase.from("questions").update(payload).eq("id", editing)
      : await supabase.from("questions").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Questão atualizada" : "Questão cadastrada");
    setForm({ ...empty, subject: form.subject, topic: form.topic });
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["questions"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta questão?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["questions"] });
  };

  const setOpt = (i: number, v: string) => setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) }));
  const shown = list.filter((q) => `${q.subject} ${q.topic} ${q.statement}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl">{editing ? "Editar questão" : "Nova questão"}</h1>
          {editing && <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(null); setForm(empty); }}><X className="h-4 w-4" /></Button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Matéria</Label><Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} list="subs" /></div>
          <div className="space-y-1.5"><Label>Assunto</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></div>
          <datalist id="subs">{[...new Set(list.map((q) => q.subject))].map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="space-y-1.5"><Label>Enunciado</Label><Textarea required rows={4} value={form.statement} onChange={(e) => setForm({ ...form, statement: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Alternativas (marque a correta)</Label>
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" checked={form.correct_index === i} onChange={() => setForm({ ...form, correct_index: i })} className="accent-[var(--primary)]" />
              <span className="w-5 font-semibold">{letters[i]}</span>
              <Input value={o} onChange={(e) => setOpt(i, e.target.value)} />
              {form.options.length > 2 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, j) => j !== i), correct_index: f.correct_index >= i && f.correct_index > 0 ? f.correct_index - (f.correct_index === i ? 0 : 1) : f.correct_index }))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {form.options.length < 6 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, options: [...f.options, ""] }))}><Plus className="mr-1 h-4 w-4" /> Alternativa</Button>
          )}
        </div>
        <div className="space-y-1.5"><Label>Comentário / explicação (opcional)</Label><Textarea rows={3} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} /></div>
        <Button type="submit" className="w-full">{editing ? "Salvar alterações" : "Cadastrar questão"}</Button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-2xl">Banco ({list.length})</h2>
          <CsvImport onDone={() => qc.invalidateQueries({ queryKey: ["questions"] })} />
          <Input placeholder="Buscar…" className="ml-auto max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {shown.map((q) => (
          <div key={q.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{q.subject}{q.topic && ` · ${q.topic}`}</p>
                <p className="mt-1 line-clamp-2">{q.statement}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setEditing(q.id); setForm({ subject: q.subject, topic: q.topic, statement: q.statement, options: q.options, correct_index: q.correct_index, explanation: q.explanation }); window.scrollTo({ top: 0 }); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-muted-foreground">Nenhuma questão.</p>}
      </div>
    </div>
  );
}
