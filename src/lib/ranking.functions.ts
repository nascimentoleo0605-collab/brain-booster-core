import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Cross-user totals need privileged access; authorization is checked above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error: profileError } = await supabaseAdmin.from("profiles").select("id, full_name");
    if (profileError) throw new Error("Não foi possível carregar o ranking.");
    // Every correct answer counts (bank, Meu Assistente, finished Provões), including repeats.
    const counts = new Map<string, number>();
    const add = (id: string, n = 1) => counts.set(id, (counts.get(id) ?? 0) + n);
    const PAGE = 1000;
    for (const table of ["attempts", "assistant_attempts"] as const) {
      for (let from = 0; ; from += PAGE) {
        const { data: rows, error } = await supabaseAdmin.from(table).select("user_id")
          .eq("is_correct", true).order("id").range(from, from + PAGE - 1);
        if (error) throw new Error("Não foi possível carregar o ranking.");
        for (const row of rows ?? []) add(row.user_id);
        if (!rows || rows.length < PAGE) break;
      }
    }
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabaseAdmin.from("provao_sessions").select("user_id, score")
        .eq("status", "completed").order("id").range(from, from + PAGE - 1);
      if (error) throw new Error("Não foi possível carregar o ranking.");
      for (const row of rows ?? []) add(row.user_id, row.score ?? 0);
      if (!rows || rows.length < PAGE) break;
    }
    // Longest consecutive correct-answer streak per user, matching the flame shown in Estudar.
    // Bank and Meu Assistente answers both feed the streak, merged in time order.
    const byUser = new Map<string, { t: string; ok: boolean }[]>();
    for (const table of ["attempts", "assistant_attempts"] as const) {
      for (let from = 0; ; from += PAGE) {
        const { data: rows, error } = await supabaseAdmin.from(table).select("user_id, is_correct, created_at")
          .order("id").range(from, from + PAGE - 1);
        if (error) throw new Error("Não foi possível carregar o ranking.");
        for (const row of rows ?? []) {
          const list = byUser.get(row.user_id) ?? [];
          list.push({ t: row.created_at, ok: row.is_correct });
          byUser.set(row.user_id, list);
        }
        if (!rows || rows.length < PAGE) break;
      }
    }
    const best = new Map<string, number>();
    for (const [userId, list] of byUser) {
      list.sort((x, y) => x.t.localeCompare(y.t));
      let cur = 0, top = 0;
      for (const r of list) { cur = r.ok ? cur + 1 : 0; if (cur > top) top = cur; }
      best.set(userId, top);
    }
    let record: { name: string; streak: number } | null = null;
    for (const [userId, streak] of best) {
      if (streak < 1) continue;
      const profile = (profiles ?? []).find((p) => p.id === userId);
      const name = profile?.full_name.trim() || "Estudante";
      if (!record || streak > record.streak) record = { name, streak };
    }
    const entries = (profiles ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name.trim() || "Estudante",
      correct: counts.get(profile.id) ?? 0,
    })).sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name));
    return { entries, record };
  });