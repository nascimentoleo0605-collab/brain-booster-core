import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
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
  const link = "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground";
  const active = { className: "rounded-md px-3 py-1.5 text-sm bg-primary text-primary-foreground" };
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to="/painel" className="mr-4 flex items-center gap-2 font-serif text-xl font-semibold">
            <BookOpen className="h-5 w-5 text-primary" /> Caderno
          </Link>
          <nav className="flex flex-wrap gap-1">
            <Link to="/painel" className={link} activeProps={active}>Desempenho</Link>
            <Link to="/estudar" className={link} activeProps={active}>Estudar</Link>
            {isAdmin && (
              <>
                <Link to="/admin/questoes" className={link} activeProps={active}>Questões</Link>
                <Link to="/admin/usuarios" className={link} activeProps={active}>Usuários</Link>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
