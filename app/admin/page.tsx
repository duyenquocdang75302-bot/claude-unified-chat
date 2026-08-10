"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Bot,
  CalendarDays,
  LoaderCircle,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { UsageDashboard } from "@/types/usage";

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("zh-CN");
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/usage", { cache: "no-store" });
      const body = (await response.json()) as UsageDashboard & { error?: string };
      if (!response.ok) throw new Error(body.error || "读取失败");
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const maxDaily = useMemo(
    () => Math.max(1, ...(data?.daily.map((item) => item.totalTokens) ?? [])),
    [data],
  );

  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="rounded-xl p-2 text-muted hover:bg-muted/10 hover:text-ink">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold">管理员用量</h1>
            <p className="text-xs text-muted">查看通过本网站产生的 Token 用量</p>
          </div>
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />刷新
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-7">
        {loading && !data ? (
          <div className="flex min-h-72 items-center justify-center text-muted">
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />正在读取用量…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "总 Token", value: formatTokens(data.totals.totalTokens), icon: Activity },
                { label: "输入 Token", value: formatTokens(data.totals.promptTokens), icon: CalendarDays },
                { label: "输出 Token", value: formatTokens(data.totals.completionTokens), icon: Bot },
                { label: "请求次数", value: data.totals.requests.toLocaleString("zh-CN"), icon: Users },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-line bg-panel p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm text-muted"><Icon className="h-4 w-4" />{label}</div>
                  <p className="text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-line bg-panel p-5">
                <h2 className="font-semibold">按账号统计</h2>
                <p className="mb-4 mt-1 text-xs text-muted">每个账号只统计经过本网站的请求</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-line text-xs text-muted">
                      <tr><th className="pb-3">账号</th><th className="pb-3">请求</th><th className="pb-3">输入</th><th className="pb-3">输出</th><th className="pb-3 text-right">总计</th></tr>
                    </thead>
                    <tbody>
                      {data.users.map((item) => (
                        <tr key={item.userId} className="border-b border-line/70 last:border-0">
                          <td className="py-3 font-medium">{item.username}</td>
                          <td className="py-3">{item.requests}</td>
                          <td className="py-3">{formatTokens(item.promptTokens)}</td>
                          <td className="py-3">{formatTokens(item.completionTokens)}</td>
                          <td className="py-3 text-right font-medium">{formatTokens(item.totalTokens)}</td>
                        </tr>
                      ))}
                      {!data.users.length ? <tr><td colSpan={5} className="py-8 text-center text-muted">暂无使用记录</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-panel p-5">
                <h2 className="font-semibold">最近 30 天</h2>
                <p className="mb-4 mt-1 text-xs text-muted">每天的总 Token 使用趋势</p>
                <div className="flex h-48 items-end gap-1.5">
                  {data.daily.length ? data.daily.map((item) => (
                    <div key={item.date} className="group relative flex h-full min-w-0 flex-1 items-end">
                      <div className="w-full rounded-t bg-accent/70 transition hover:bg-accent" style={{ height: `${Math.max(4, (item.totalTokens / maxDaily) * 100)}%` }} />
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-canvas shadow group-hover:block">
                        {item.date} · {formatTokens(item.totalTokens)}
                      </div>
                    </div>
                  )) : <div className="flex h-full w-full items-center justify-center text-sm text-muted">暂无趋势数据</div>}
                </div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-line bg-panel p-5">
                <h2 className="mb-4 font-semibold">模型用量</h2>
                <div className="space-y-3">
                  {data.models.map((item) => (
                    <div key={item.model}>
                      <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-mono">{item.model}</span><span>{formatTokens(item.totalTokens)}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (item.totalTokens / Math.max(1, data.totals.totalTokens)) * 100)}%` }} /></div>
                    </div>
                  ))}
                  {!data.models.length ? <p className="py-8 text-center text-sm text-muted">暂无模型用量</p> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-panel p-5">
                <h2 className="font-semibold">最近请求</h2>
                <p className="mb-4 mt-1 text-xs text-muted">“估算”表示上游未返回完整 usage 字段</p>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {data.recent.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-xl bg-canvas p-3 text-sm">
                      <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.username} · {item.model}</p><p className="mt-0.5 text-xs text-muted">{formatTime(item.createdAt)} · {item.purpose === "title" ? "生成标题" : "聊天"}</p></div>
                      <div className="text-right"><p className="font-medium">{formatTokens(item.totalTokens)}</p>{item.estimated ? <p className="text-[10px] text-amber-600">估算</p> : null}</div>
                    </div>
                  ))}
                  {!data.recent.length ? <p className="py-8 text-center text-sm text-muted">暂无请求记录</p> : null}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
