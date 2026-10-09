import { useState } from "react";
import { toast } from "sonner";
import { DatabaseZap, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Props = { subject: string; topic: string; statement: string; options: string[]; correctIndex: number; explanation: string };

// Visible only to admins (caller checks); the database also only accepts inserts from admins.
export function AddToBankButton(p: Props) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  async function add() {
    setState("saving");
    const { data: existing } = await supabase.from("questions").select("id").eq("statement", p.statement.trim()).limit(1);
    if (existing?.length) { setState("done"); toast.info("Essa questão já está no banco."); return; }
    const { error } = await supabase.from("questions").insert({ subject: p.subject.trim(), topic: p.topic.trim(), statement: p.statement.trim(), options: p.options, correct_index: p.correctIndex, explanation: p.explanation.trim() });
    if (error) { setState("idle"); toast.error("Não foi possível adicionar: " + error.message); return; }
    setState("done");
    toast.success(`Adicionada ao banco em ${p.subject}${p.topic ? ` · ${p.topic}` : ""}.`);
  }
  return (
    <Button type="button" size="sm" variant="outline" disabled={state !== "idle"} onClick={add} className="gap-2">
      {state === "saving" ? <LoaderCircle className="size-4 animate-spin" /> : state === "done" ? <Check className="size-4" /> : <DatabaseZap className="size-4" />}
      {state === "done" ? "No banco de questões" : "Adicionar ao banco"}
    </Button>
  );
}
