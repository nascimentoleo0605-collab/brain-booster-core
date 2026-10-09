import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAiRunIdFetch } from "./ai-run-id.server";

export const AI_MODEL = "openai/gpt-5.6-luna";

export function createAiModel(apiKey: string) {
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createAiRunIdFetch(),
    supportsStructuredOutputs: true,
  });
  return provider.chatModel(AI_MODEL);
}
