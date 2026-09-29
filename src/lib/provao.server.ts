import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { createAiRunIdFetch } from "./ai-run-id.server";

export type ExamQuestion = {
  sourceId: string;
  subject: string;
  topic: string;
  statement: string;
  options: string[];
  correct_index: number;
  explanation: string;
};
export type ReferenceQuestion = ExamQuestion;

const outputSchema = z.object({ questions: z.array(z.object({
  sourceId: z.string(),
  statement: z.string(),
  options: z.array(z.string()),
  correct_index: z.number(),
  explanation: z.string(),
})) });

function gatewayError(error: unknown): Error {
  const e = error as { statusCode?: number; responseBody?: string; message?: string } | null;
  let safe = "";
  try {
    const body = JSON.parse(e?.responseBody ?? "{}") as { message?: string; error?: { message?: string } };
    safe = body.message ?? body.error?.message ?? "";
  } catch { /* Invalid upstream error body. */ }
  if (e?.statusCode === 402 || e?.statusCode === 403) return new Error(safe.slice(0, 300) || "A geração por IA está indisponível para este espaço.");
  if (e?.statusCode === 429) return new Error("Muitas gerações em andamento. Aguarde um pouco e continue o Provão.");
  if (e?.statusCode && e.statusCode >= 500) return new Error("A IA está temporariamente indisponível. Continue o Provão mais tarde.");
  if (e?.statusCode === 401) return new Error("A geração por IA não está configurada.");
  if (e?.statusCode === 400) return new Error(safe.slice(0, 300) || "A IA não conseguiu processar estas questões.");
  return new Error("A IA não conseguiu gerar este bloco de questões. Continue mais tarde sem perder o progresso.");
}

export async function generateProvaoBatch(apiKey: string, references: ReferenceQuestion[]): Promise<ExamQuestion[]> {
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1", apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createAiRunIdFetch(),
  });
  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      output: Output.object({ schema: outputSchema }),
      system: "Você é um professor que elabora simulados inéditos para formação policial em português brasileiro. Use SOMENTE os conceitos das questões de referência. Preserve a resposta factualmente correta, mas crie enunciados e alternativas novos e autocontidos; não copie o texto original. Não invente leis, números ou fatos não presentes. Produza uma questão para CADA referência, com exatamente quatro alternativas distintas e uma única correta. Dê uma explicação curta e objetiva para o gabarito. Entregue sempre o resultado estruturado completo.",
      prompt: `Reescreva as ${references.length} referências abaixo como ${references.length} questões inéditas, na mesma ordem. Preserve exatamente cada sourceId. Use os conceitos dos gabaritos e comentários. Distribua a posição da resposta correta entre A, B, C e D. Evite ambiguidade.\n\n${references.map((q, i) => `${i + 1}. sourceId: ${q.sourceId}\nMatéria: ${q.subject}; Assunto: ${q.topic}\nEnunciado: ${q.statement}\nAlternativas: ${q.options.map((option, index) => `${String.fromCharCode(65 + index)}) ${option}`).join(" | ")}\nResposta correta: ${q.options[q.correct_index]}\nComentário: ${q.explanation || "Sem comentário."}`).join("\n\n")}`,
      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
    });
    const parsed = await result.output;
    if (!parsed || parsed.questions.length !== references.length) throw new Error("incomplete");
    return references.map((reference, index) => {
      const question = parsed.questions[index];
      if (!question || question.sourceId !== reference.sourceId || question.statement.trim().length < 20 || question.options.length !== 4 || question.options.some((option) => !option.trim()) || new Set(question.options.map((option) => option.trim().toLowerCase())).size !== 4 || !Number.isInteger(question.correct_index) || question.correct_index < 0 || question.correct_index > 3 || !question.explanation.trim()) throw new Error("invalid");
      return { sourceId: reference.sourceId, subject: reference.subject, topic: reference.topic, statement: question.statement.trim(), options: question.options.map((option) => option.trim()), correct_index: question.correct_index, explanation: question.explanation.trim() };
    });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) throw new Error("A IA não completou este bloco. Continue o Provão mais tarde.");
    if (error instanceof Error && ["incomplete", "invalid"].includes(error.message)) throw new Error("A IA não completou este bloco. Continue o Provão mais tarde.");
    throw gatewayError(error);
  }
}