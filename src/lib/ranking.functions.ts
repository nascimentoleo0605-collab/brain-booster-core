import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Cross-user totals need privileged access; authorization is checked above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error: profileError } = await supabaseAdmin.from("profiles").select("id, full_name");
    if (profileError) throw new Error("Não foi possível carregar o ranking.");
    // Every correct attempt counts, including repeats; paginate past the 1,000-row response cap.
    const counts = new Map<string, number>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: attempts, error } = await supabaseAdmin.from("attempts").select("user_id")
        .eq("is_correct", true).order("id").range(from, from + PAGE - 1);
      if (error) throw new Error("Não foi possível carregar o ranking.");
      for (const attempt of attempts ?? []) counts.set(attempt.user_id, (counts.get(attempt.user_id) ?? 0) + 1);
      if (!attempts || attempts.length < PAGE) break;
    }
    return (profiles ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name.trim() || "Estudante",
      correct: counts.get(profile.id) ?? 0,
    })).sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name));
  });