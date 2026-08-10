"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { enabled, user } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled || user) window.location.replace("/");
  }, [enabled, user]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "登录失败");
      const target = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.replace(target.startsWith("/") ? target : "/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    } finally { setLoading(false); }
  };
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-5">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-panel p-7 shadow-soft sm:p-9">
        <div className="mb-7 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white"><Bot className="h-6 w-6" /></div><div><h1 className="font-semibold text-ink">Claude Unified Chat</h1><p className="text-xs text-muted">使用分配给您的账号登录</p></div></div>
        <form onSubmit={submit}>
          <label className="mb-2 block text-sm font-medium text-ink" htmlFor="username">账号</label>
          <div className="relative"><UserRound className="absolute left-3 top-3 h-4 w-4 text-muted" /><input id="username" autoFocus autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="h-10 w-full rounded-xl border border-line bg-canvas pl-10 pr-3 text-sm text-ink outline-none focus:border-accent" /></div>
          <label className="mb-2 mt-4 block text-sm font-medium text-ink" htmlFor="password">密码</label>
          <div className="relative"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-muted" /><input id="password" autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full rounded-xl border border-line bg-canvas pl-10 pr-3 text-sm text-ink outline-none focus:border-accent" /></div>
          {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
          <Button type="submit" variant="primary" className="mt-5 w-full" disabled={!username.trim() || !password || loading}>{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}登录</Button>
        </form>
      </div>
    </main>
  );
}
