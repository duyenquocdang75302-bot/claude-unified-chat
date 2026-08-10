"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Check, ExternalLink, KeyRound, LoaderCircle, LogOut, Moon, Sun, SunMoon, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ModelSelector } from "@/components/models/ModelSelector";
import { useModels } from "@/hooks/useModels";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/contexts/ToastContext";
import type { ThemePreference } from "@/types/settings";

export default function SettingsPage() {
  const { user } = useAuth();
  const { settings, updateSettings, hydrated } = useSettings();
  const { models, loading } = useModels();
  const { notify } = useToast();
  const [baseUrl, setBaseUrl] = useState("正在读取…");
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/config").then((response) => response.json()).then((data: { baseUrl: string; passwordEnabled: boolean }) => { setBaseUrl(data.baseUrl); setPasswordEnabled(data.passwordEnabled); }).catch(() => setBaseUrl("读取失败"));
  }, []);
  if (!hydrated) return <div className="flex h-dvh items-center justify-center bg-canvas text-muted"><LoaderCircle className="h-6 w-6 animate-spin" /></div>;
  const themes: Array<{ id: ThemePreference; label: string; icon: typeof Sun }> = [{ id: "system", label: "跟随系统", icon: SunMoon }, { id: "light", label: "浅色", icon: Sun }, { id: "dark", label: "深色", icon: Moon }];
  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur"><div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4"><Link href="/" className="rounded-xl p-2 text-muted hover:bg-muted/10 hover:text-ink"><ArrowLeft className="h-5 w-5" /></Link><div><h1 className="font-semibold">设置</h1><p className="text-xs text-muted">新会话的默认配置</p></div></div></header>
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-7">
        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6"><h2 className="mb-1 font-semibold">默认模型</h2><p className="mb-4 text-sm text-muted">新建会话时自动使用；现有会话不会改变。</p><ModelSelector model={settings.defaultModel} models={models} loading={loading} onChange={(defaultModel) => updateSettings({ defaultModel })} /></section>
        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6"><h2 className="mb-5 font-semibold">默认参数</h2>
          <label className="mb-6 block text-sm"><span className="mb-2 flex justify-between"><span>Temperature</span><span className="text-muted">{settings.temperature.toFixed(1)}</span></span><input className="w-full accent-[rgb(var(--accent))]" type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={(event) => updateSettings({ temperature: Number(event.target.value) })} /></label>
          <label className="mb-6 block text-sm"><span className="mb-2 flex justify-between"><span>最大输出 Tokens</span><span className="text-muted">{settings.maxTokens}</span></span><input className="w-full accent-[rgb(var(--accent))]" type="range" min="1024" max="16384" step="1024" value={settings.maxTokens} onChange={(event) => updateSettings({ maxTokens: Number(event.target.value) })} /></label>
          <label className="block text-sm"><span className="mb-2 block">全局系统提示词</span><textarea className="min-h-32 w-full resize-y rounded-xl border border-line bg-canvas p-3 outline-none focus:border-accent" value={settings.systemPrompt} onChange={(event) => updateSettings({ systemPrompt: event.target.value })} placeholder="留空表示不设置系统提示词" /></label>
        </section>
        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6"><h2 className="mb-4 font-semibold">外观主题</h2><div className="grid grid-cols-3 gap-2">{themes.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => updateSettings({ theme: id })} className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-sm ${settings.theme === id ? "border-accent bg-accent/10" : "border-line hover:bg-muted/10"}`}><Icon className="h-5 w-5" />{label}{settings.theme === id ? <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-accent" /> : null}</button>)}</div></section>
        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <h2 className="mb-4 font-semibold">账号与服务</h2>
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-canvas p-4"><UserRound className="h-5 w-5 text-accent" /><div><p className="text-sm font-medium">{user?.username ?? "当前用户"}</p><p className="text-xs text-muted">{user?.role === "admin" ? "管理员账号" : "成员账号"}</p></div></div>
          <div className="rounded-xl bg-canvas p-4"><p className="text-xs font-medium text-muted">当前 Base URL</p><p className="mt-1 break-all font-mono text-sm">{baseUrl}</p></div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted"><KeyRound className="h-4 w-4" />每个账号使用服务端绑定的 API Key，浏览器无法查看。</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {user?.role === "admin" ? <Link href="/admin" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-panel px-4 text-sm font-medium text-ink hover:bg-muted/10"><BarChart3 className="h-4 w-4" />查看 Token 用量</Link> : null}
            {passwordEnabled ? <Button variant="ghost" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.replace("/login"); }}><LogOut className="h-4 w-4" />退出账号</Button> : null}
          </div>
        </section>
        <div className="flex items-center justify-between px-1 text-xs text-muted"><span>设置会自动保存到当前浏览器</span><button className="flex items-center gap-1 text-accent" onClick={() => notify("设置已保存", "success")}>确认保存 <ExternalLink className="h-3 w-3" /></button></div>
      </div>
    </main>
  );
}
