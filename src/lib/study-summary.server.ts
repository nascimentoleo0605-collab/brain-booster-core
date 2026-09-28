import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createAiRunIdFetch } from "./ai-run-id.server";

const MODEL = "openai/gpt-6-astra";

function gatewayMessage(error: unknown) {
  if (!error || typeof error !== "object") return "Não foi possível gerar o resumo agora.";
  const candidate = error as { statusCode?: number; responseBody?: string; message?: string };
  let upstreamMessage = "";
  if (candidate.responseBody) {
    try {
      const parsed = JSON.parse(candidate.responseBody) as { message?: string; error?: { message?: string } };
      upstreamMessage = parsed.message ?? parsed.error?.message ?? "";
    } catch {
      upstreamMessage = "";
    }
  }
  if (upstreamMessage && upstreamMessage.length <= 300) return upstreamMessage;
  if (candidate.statusCode === 401) return "A geração por IA não está configurada neste momento.";
  if (candidate.statusCode === 402) return "Os créditos de IA acabaram. O responsável pelo espaço precisa adicionar créditos.";
  if (candidate.statusCode === 403) return "A geração por IA está indisponível para este espaço no momento.";
  if (candidate.statusCode === 429) return "Há muitas gerações em andamento. Aguarde um pouco e tente novamente.";
  if (candidate.statusCode && candidate.statusCode >= 500) return "O serviço de IA está temporariamente indisponível. Tente novamente mais tarde.";
  return candidate.message && candidate.message.length <= 200
    ? candidate.message
    : "Não foi possível gerar o resumo agora.";
}

export async function createStudySummary(input: {
  apiKey: string;
  subject: string;
  topic: string;
  references: Array<{ statement: string; explanation: string }>;
}) {
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: input.apiKey,
    headers: {
      "Lovable-API-Key": input.apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: createAiRunIdFetch(),
  });
  const referenceText = input.references
    .map((item, index) => `${index + 1}. ${item.statement}${item.explanation ? `\nComentário: ${item.explanation}` : ""}`)
    .join("\n\n")
    .slice(0, 18_000);

  try {
    const result = streamText({
      model: provider.responses(MODEL),
      system: "Você é um professor didático. Escreva em português brasileiro, com precisão e linguagem clara. Produza somente o resumo solicitado, sem saudações, sem mencionar IA e sem inventar referências bibliográficas.",
      prompt: `Crie um resumo de estudo completo e objetivo sobre a matéria “${input.subject}”, assunto “${input.topic}”.\n\nOrganize o texto exatamente nesta ordem:\nVISÃO GERAL\nCONCEITOS PRINCIPAIS\nPONTOS DE ATENÇÃO\nREVISÃO RÁPIDA\n\nUse parágrafos curtos e listas iniciadas por • quando ajudarem. Explique termos importantes e destaque relações que costumam ser cobradas em questões. Não inclua perguntas de múltipla escolha.\n\nQuestões e comentários cadastrados como referência de escopo:\n${referenceText || "Nenhuma referência adicional cadastrada."}`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const text = (await result.text).trim();
    if (!text) throw new Error("A IA não retornou conteúdo para este assunto.");
    return text;
  } catch (error) {
    throw new Error(gatewayMessage(error));
  }
}