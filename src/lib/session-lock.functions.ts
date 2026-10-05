import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function sessionIdOf(claims: unknown): string {
  const id = (claims as { session_id?: unknown } | null)?.session_id;
  if (typeof id !== "string" || !id) throw new Error("Sessão inválida.");
  return id;
}

// Called right after sign-in: this device becomes the only active one.
export const claimSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sessionId = sessionIdOf(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("active_sessions")
      .upsert({ user_id: context.userId, session_id: sessionId, updated_at: new Date().toISOString() });
    if (error) throw new Error("Não foi possível registrar o acesso.");
    return { ok: true };
  });

// Returns false when another device signed in later with the same account.
export const checkSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sessionId = sessionIdOf(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("active_sessions").select("session_id").eq("user_id", context.userId).maybeSingle();
    if (!data) {
      await supabaseAdmin.from("active_sessions").insert({ user_id: context.userId, session_id: sessionId });
      return { active: true };
    }
    return { active: data.session_id === sessionId };
  });
