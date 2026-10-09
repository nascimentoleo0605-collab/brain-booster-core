import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const turnSchema = z.object({ role: z.enum(["banca", "aluno"]), text: z.string().max(2000) });

export const bancaTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      subject: z.string().min(1).max(200),
      topic: z.string().max(200).nullable(),
      history: z.array(turnSchema).max(40),
      event: z.enum(["start", "answer", "idle", "end"]),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Estamos em atualizações no momento. Tente novamente em breve.");
    const { streamText } = await import("ai");
    const { createAiModel } = await import("./ai-model.server");

    const recent = data.history.slice(-6)
      .map((t) => `${t.role === "banca" ? "Examinadora" : "Candidato"}: ${t.text}`)
      .join("\n");
    const focus = data.topic ? `${data.subject} — assunto: ${data.topic}` : `${data.subject} (assuntos variados)`;
    const instruction = {
      start: "Cumprimente o candidato em uma frase curta e faça a primeira pergunta.",
      answer:
        "Responda em duas partes separadas pela sequência exata '|||' (três caracteres, sem espaços entre eles, nada antes nem depois). " +
        "Primeira parte: avalie a última resposta do candidato em até 3 frases, com tolerância — interprete a intenção da fala, mesmo com palavras imprecisas ou erros de transcrição de voz; " +
        "se a resposta estiver correta mas incompleta, considere-a acerto, confirme e apenas complemente o que faltou em 1 frase; se estiver errada ou ele disser que não sabe, explique o ponto com gentileza. " +
        "Segunda parte: faça a próxima pergunta, diferente das anteriores. Nunca escreva '|||' fora dessa separação.",
      idle: "O candidato ficou em silêncio. Pergunte de forma breve se ele ainda está aí e se quer que repita a pergunta.",
      end: "Encerre a sessão em até 3 frases: dê um balanço do desempenho do candidato, uma nota de 0 a 10 e qual ponto estudar mais.",
    }[data.event];

    try {
      const result = streamText({
        model: createAiModel(apiKey),
        providerOptions: { lovable: { reasoningEffort: "none" } },
        system: `Você é uma examinadora de banca oral para concurso de Curso de Formação de Praças da Polícia Militar. Fale em português do Brasil, em tom formal, cordial e didático. Seu texto será lido em voz alta: não use listas, markdown, emojis ou siglas soltas. Faça uma pergunta por vez, objetiva, que possa ser respondida falando. O candidato responde por voz e a transcrição pode ter imperfeições: interprete sempre a intenção da fala, mesmo com palavras trocadas ou frases truncadas. Seja tolerante com respostas incompletas: se a ideia central estiver correta, trate como acerto e apenas complemente o que faltou, sem desaprovar. Nunca mencione que é uma IA. Quando a tarefa pedir duas partes, separe-as com '|||' exatamente como pedido. Tema: ${focus}.`,
        prompt: `${recent ? `Conversa recente:\n${recent}\n\n` : ""}Tarefa: ${instruction}`,
      });
      const text = (await result.text).trim();
      if (!text) throw new Error("empty");
      return { text };
    } catch {
      throw new Error("Estamos em atualizações no momento. Tente novamente em breve.");
    }
  });
