import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Cross-user totals need privileged access; authorization is checked above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error: profileError }, { data: attempts, error: attemptError }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name"),
      supabaseAdmin.from("attempts").select("user_id").eq("is_correct", true),
    ]);
    if (profileError || attemptError) throw new Error("Não foi possível carregar o ranking.");
    const counts = new Map<string, number>();
    for (const attempt of attempts ?? []) counts.set(attempt.user_id, (counts.get(attempt.user_id) ?? 0) + 1);
    return (profiles ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name.trim() || "Estudante",
      correct: counts.get(profile.id) ?? 0,
    })).sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name));
  });