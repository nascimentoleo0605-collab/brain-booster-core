import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { needsSetup, setupFirstAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Caderno de Questões" },
      { name: "description", content: "Acesse sua conta para estudar e acompanhar seu desempenho." },
      { property: "og:title", content: "Entrar — Caderno de Questões" },
      { property: "og:description", content: "Acesse sua conta para estudar e acompanhar seu desempenho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const checkSetup = useServerFn(needsSetup);
  const setup = useServerFn(setupFirstAdmin);
  const [mode, setMode] = useState<"login" | "setup" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel" });
    });
    checkSetup().then((r) => setMode(r.needsSetup ? "setup" : "login")).catch(() => setMode("login"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "setup") {
        await setup({ data: { email, password, fullName } });
        toast.success("Administrador criado!");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("E-mail ou senha incorretos.");
      navigate({ to: "/painel" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-7">
        <div className="mb-8 flex items-center gap-3 font-serif text-xl font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><BookOpen className="h-5 w-5" /></span> Caderno
        </div>
        {mode === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="font-serif text-2xl font-semibold">{mode === "setup" ? "Configurar administrador" : "Entrar"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "setup"
                  ? "Primeiro acesso: crie a conta do administrador."
                  : "Use o acesso fornecido pelo administrador."}
              </p>
            </div>
            {mode === "setup" && (
              <div className="space-y-1.5">
                <Label htmlFor="n">Nome</Label>
                <Input id="n" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="e">E-mail</Label>
              <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Senha</Label>
              <Input id="p" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Aguarde…" : mode === "setup" ? "Criar e entrar" : "Entrar"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
