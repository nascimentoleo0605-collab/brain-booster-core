import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStudySummary } from "./study-summary.server";

const summaryInput = z.object({
  subject: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(120),
});

export const generateStudySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => summaryInput.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env['LOVABLE_API_KEY']!;
    if (!apiKey) throw new Error("A geração por IA não está configurada neste momento.");

    const { data: references, error } = await context.supabase
      .from("questions")
      .select("statement, explanation")
      .eq("subject", data.subject)
      .eq("topic", data.topic)
      .limit(40);
    if (error) throw new Error("Não foi possível consultar o conteúdo deste assunto.");

    const summary = await createStudySummary({
      apiKey,
      subject: data.subject,
      topic: data.topic,
      references: references ?? [],
    });
    return { summary };
  });