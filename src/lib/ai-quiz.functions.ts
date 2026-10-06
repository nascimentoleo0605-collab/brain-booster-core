import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateProvaoBatch, type ReferenceQuestion } from "./provao.server";

export const generateAiQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ subject: z.string().min(1).max(120), topic: z.string().max(120).nullable(), count: z.union([z.literal(10), z.literal(20), z.literal(30)]).default(10) }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("questions").select("id,subject,topic,statement,options,correct_index,explanation").eq("subject", data.subject).limit(300);
    if (data.topic) q = q.eq("topic", data.topic);
    const { data: rows, error } = await q;
    if (error) throw new Error("Não foi possível ler as questões de referência.");
    const refs: ReferenceQuestion[] = [];
    for (const r of rows ?? []) {
      if (!Array.isArray(r.options) || r.options.length < 2 || !r.statement || typeof r.options[r.correct_index] !== "string") continue;
      refs.push({ sourceId: r.id, subject: r.subject ?? "", topic: r.topic ?? "", statement: r.statement, options: r.options as string[], correct_index: r.correct_index, explanation: r.explanation ?? "" });
    }
    if (refs.length === 0) throw new Error("Ainda não há questões cadastradas para este assunto.");
    for (let i = refs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [refs[i], refs[j]] = [refs[j]!, refs[i]!]; }
    const picked = Array.from({ length: data.count }, (_, i) => refs[i % refs.length]!);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("A geração por IA não está configurada.");
    const tagged = picked.map((r, i) => ({ ...r, sourceId: `${r.sourceId}-${i}` }));
    const chunks = Array.from({ length: Math.ceil(tagged.length / 10) }, (_, i) => tagged.slice(i * 10, i * 10 + 10));
    const questions = (await Promise.all(chunks.map((c) => generateProvaoBatch(apiKey, c)))).flat();
    return questions.map((x, i) => ({ id: `${i}`, ...x }));
  });

export const generateAiQuizFromMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ material: z.string().min(200, "O PDF tem pouco texto legível.").max(200_000), count: z.union([z.literal(10), z.literal(20), z.literal(30)]).default(10) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("A geração por IA não está configurada.");
    const { generateFromMaterial } = await import("./ai-quiz.server");
    const qs = await generateFromMaterial(apiKey, data.material.slice(0, 60_000), data.count);
    return qs.map((x, i) => ({ id: `${i}`, ...x }));
  });
