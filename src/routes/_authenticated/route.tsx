import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BarChart3, BookOpen, FileQuestion, GraduationCap, LogOut, Users, Trophy, LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = !!roles?.some((r) => r.role === "admin");
    return { user: data.user, isAdmin };
  },
  component: Layout,
});

function Layout() {
  const { isAdmin, user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const link = "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
  const active = { className: "flex h-10 items-center gap-3 rounded-md bg-sidebar-accent px-3 text-sm font-medium text-sidebar-accent-foreground" };
  return (
    <div className="min-h-screen bg-background p-0 md:p-4">
      <div className="mx-auto flex min-h-screen max-w-[1440px] overflow-hidden border-border bg-card/30 md:min-h-[calc(100vh-2rem)] md:rounded-lg md:border">
        <aside className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-sidebar-border bg-sidebar md:static md:h-auto md:w-56 md:flex-col md:border-r md:border-t-0">
          <Link to="/painel" className="hidden h-20 items-center gap-3 border-b border-sidebar-border px-5 font-serif text-lg font-semibold md:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><BookOpen className="h-5 w-5" /></span>
            Caderno
          </Link>
           <nav className="flex flex-1 items-center justify-around gap-1 overflow-x-auto p-2 md:block md:space-y-1 md:p-3">
            <Link to="/painel" className={link} activeProps={active}><BarChart3 /> <span>Desempenho</span></Link>
            <Link to="/estudar" className={link} activeProps={active}><GraduationCap /> <span>Estudar</span></Link>
             <Link to="/materias" className={link} activeProps={active}><LayoutGrid /> <span>Matérias</span></Link>
             <Link to="/ranking" className={link} activeProps={active}><Trophy /> <span>Ranking</span></Link>
            {isAdmin && (
              <>
                <Link to="/admin/questoes" className={link} activeProps={active}><FileQuestion /> <span>Questões</span></Link>
                <Link to="/admin/usuarios" className={link} activeProps={active}><Users /> <span>Usuários</span></Link>
              </>
            )}
          </nav>
          <div className="hidden border-t border-sidebar-border p-3 md:block">
            <p className="truncate px-3 text-xs text-muted-foreground">{user.email}</p>
            <Button className="mt-2 w-full justify-start" variant="ghost" size="sm" onClick={signOut}>
              <LogOut /> Sair
            </Button>
          </div>
        </aside>
        <section className="min-w-0 flex-1">
          <header className="flex h-16 items-center justify-between border-b px-5 md:h-20 md:px-8">
            <div>
              <p className="font-serif text-base font-semibold">Área de estudos</p>
              <p className="text-xs text-muted-foreground">Acompanhe seu progresso e continue praticando.</p>
            </div>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={signOut} aria-label="Sair"><LogOut /></Button>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8"><Outlet /></main>
        </section>
      </div>
    </div>
  );
}
