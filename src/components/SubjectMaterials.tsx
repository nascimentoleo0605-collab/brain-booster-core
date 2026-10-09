import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, LoaderCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function SubjectMaterials() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: list = [] } = useQuery({
    queryKey: ["subject-materials"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("subject_materials").select("id,subject,topic,title,created_at").order("subject");
      if (error) throw error;
      return data;
    },
  });

  async function upload() {
    if (!subject.trim() || !topic.trim() || !file) { toast.error("Informe matéria, assunto e escolha o PDF."); return; }
    if (file.size > 100 * 1024 * 1024) { toast.error("O PDF deve ter até 100 MB."); return; }
    setBusy(true);
    try {
      const { extractPdfText } = await import("@/components/PdfImport");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      if (doc.numPages > 200) throw new Error(`O PDF tem ${doc.numPages} páginas. O limite é 200.`);
      const content = (await extractPdfText(file)).trim();
      if (content.length < 200) throw new Error("Não consegui ler texto suficiente neste PDF.");
      const { error } = await supabase.from("subject_materials").insert({ subject: subject.trim(), topic: topic.trim(), title: file.name, content: content.slice(0, 1_200_000) });
      if (error) throw error;
      toast.success("Material salvo. O Meu Assistente vai usá-lo nesta matéria.");
      setFile(null); qc.invalidateQueries({ queryKey: ["subject-materials"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("subject_materials").delete().eq("id", id);
    if (error) toast.error("Não foi possível remover."); else qc.invalidateQueries({ queryKey: ["subject-materials"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><BookOpen /> Materiais do Assistente</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Materiais para o Meu Assistente</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Envie PDFs (até 200 páginas) para cada assunto. Quando o aluno escolher esse assunto, o Meu Assistente cria questões a partir do material, e não do banco. Use matéria e assunto exatamente como no banco.</p>
        <div className="grid gap-3">
          <div className="space-y-1.5"><Label>Matéria</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex.: MÓDULO 1" /></div>
          <div className="space-y-1.5"><Label>Assunto</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex.: ABORDAGEM A PESSOA A PÉ" /></div>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full rounded-md border bg-background p-2 text-sm" />
          <Button onClick={upload} disabled={busy}>{busy && <LoaderCircle className="animate-spin" />} Salvar material</Button>
        </div>
        <ul className="max-h-60 space-y-2 overflow-y-auto">
          {list.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <span className="min-w-0"><b>{m.subject}</b>{m.topic ? ` · ${m.topic}` : ""}<span className="block truncate text-xs text-muted-foreground">{m.title}</span></span>
              <Button variant="ghost" size="icon" onClick={() => remove(m.id)} aria-label="Remover"><Trash2 /></Button>
            </li>
          ))}
          {!list.length && <li className="text-sm text-muted-foreground">Nenhum material enviado ainda.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
