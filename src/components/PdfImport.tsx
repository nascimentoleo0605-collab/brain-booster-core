import { useState } from "react";
import { FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { parsePdfQuestions, type PdfQuestion } from "@/lib/pdf-question-parser";

type ReviewQuestion = PdfQuestion & { subject: string; topic: string };
type PdfTextItem = { str?: string; transform?: number[] };
const letters = "ABCDEF";

async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let pageText = "";
    for (const item of content.items as PdfTextItem[]) {
      const text = item.str?.trim();
      if (!text) continue;
      const y = item.transform?.[5] ?? null;
      pageText += lastY !== null && y !== null && Math.abs(y - lastY) > 2 ? `\n${text}` : `${pageText ? " " : ""}${text}`;
      lastY = y;
    }
    pages.push(pageText);
  }
  return pages.join("\n");
}

export function PdfImport({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);

  const reset = () => {
    setFileName("");
    setSubject("");
    setTopic("");
    setQuestions([]);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("O PDF deve ter no máximo 20 MB.");
      return;
    }
    setReading(true);
    setFileName(file.name);
    try {
      const text = await extractPdfText(file);
      if (text.trim().length < 20) {
        setQuestions([]);
        toast.error("Não foi possível ler o texto. Use um PDF com texto selecionável, não apenas imagens.");
        return;
      }
      const parsed = parsePdfQuestions(text).map((question) => ({ ...question, subject, topic }));
      setQuestions(parsed);
      if (!parsed.length) toast.error("Nenhuma questão de múltipla escolha foi reconhecida neste PDF.");
      else toast.success(`${parsed.length} questões encontradas. Confira o gabarito antes de importar.`);
    } catch {
      setQuestions([]);
      toast.error("Não foi possível abrir este PDF. Verifique se o arquivo não está protegido.");
    } finally {
      setReading(false);
    }
  };

  const update = (index: number, patch: Partial<ReviewQuestion>) => {
    setQuestions((current) => current.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question));
  };

  const applyClassification = () => {
    setQuestions((current) => current.map((question) => ({ ...question, subject: subject.trim(), topic: topic.trim() })));
  };

  const ready = questions.filter((question) => question.subject.trim() && question.correct_index !== null && question.correct_index < question.options.length);

  const importReady = async () => {
    if (!ready.length) return;
    setBusy(true);
    const payload = ready.map(({ sourceNumber: _sourceNumber, ...question }) => ({
      ...question,
      subject: question.subject.trim(),
      topic: question.topic.trim(),
      correct_index: question.correct_index ?? 0,
    }));
    const { error } = await supabase.from("questions").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${payload.length} questões importadas`);
    reset();
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><FileText className="mr-1 h-4 w-4" /> Importar PDF</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Importar questões por PDF</DialogTitle>
          <DialogDescription>
            Envie um PDF com texto selecionável. O gabarito será reconhecido quando estiver indicado por questão ou em uma seção “Gabarito”.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-subject">Matéria</Label>
            <Input id="pdf-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex.: Matemática" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdf-topic">Assunto</Label>
            <Input id="pdf-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex.: Frações" />
          </div>
          <Button type="button" variant="secondary" onClick={applyClassification} disabled={!questions.length || !subject.trim()}>
            Aplicar a todas
          </Button>
        </div>

        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-5 text-center hover:bg-muted/60">
          {reading ? <LoaderCircle className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
          <span className="text-sm font-medium">{reading ? "Lendo o PDF…" : fileName || "Selecionar arquivo PDF"}</span>
          <span className="text-xs text-muted-foreground">Até 20 MB. O arquivo não será armazenado.</span>
          <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={reading} onChange={(event) => onFile(event.target.files?.[0])} />
        </label>

        {questions.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p><strong>{questions.length}</strong> encontradas · <strong>{ready.length}</strong> prontas para importar</p>
              {ready.length < questions.length && <p className="text-destructive">Confirme a matéria e o gabarito das pendentes.</p>}
            </div>

            {questions.map((question, index) => (
              <div key={`${question.sourceNumber}-${index}`} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded bg-muted text-xs font-semibold">{question.sourceNumber}</span>
                  <Textarea className="min-h-20 flex-1" value={question.statement} onChange={(event) => update(index, { statement: event.target.value })} aria-label={`Enunciado da questão ${question.sourceNumber}`} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover questão ${question.sourceNumber}`} onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={question.subject} onChange={(event) => update(index, { subject: event.target.value })} placeholder="Matéria obrigatória" aria-label={`Matéria da questão ${question.sourceNumber}`} />
                  <Input value={question.topic} onChange={(event) => update(index, { topic: event.target.value })} placeholder="Assunto" aria-label={`Assunto da questão ${question.sourceNumber}`} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="flex cursor-pointer items-start gap-2 rounded border p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <input type="radio" name={`pdf-correct-${index}`} checked={question.correct_index === optionIndex} onChange={() => update(index, { correct_index: optionIndex })} className="mt-1 accent-[var(--primary)]" />
                      <strong>{letters[optionIndex]}</strong><span>{option}</span>
                    </label>
                  ))}
                </div>
                {question.correct_index === null && <p className="text-xs text-destructive">Resposta não reconhecida. Marque a alternativa correta.</p>}
              </div>
            ))}

            <Button className="w-full" disabled={busy || !ready.length} onClick={importReady}>
              {busy ? "Importando…" : `Importar ${ready.length} questões confirmadas`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}