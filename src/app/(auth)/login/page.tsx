"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      nickname,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center bg-slate-50 px-4 py-8">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-md sm:p-8">
        <div className="flex flex-col items-center space-y-2 text-center">
          <Brand className="text-slate-950" />
          <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
          <p className="text-sm text-slate-500">
            Entre com seu apelido, e-mail ou CPF e senha
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">Apelido</Label>
            <Input
              id="nickname"
              type="text"
              autoComplete="nickname"
              minLength={3}
              maxLength={24}
              placeholder="Seu apelido"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail ou CPF</Label>
            <Input
              id="email"
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-900">
                {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="text-center text-sm text-slate-500">
          Não tem uma conta?{" "}
          <Link href="/register" className="font-semibold text-blue-600 hover:underline">
            Crie uma agora
          </Link>
        </div>
      </div>
    </div>
  );
}
