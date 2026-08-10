"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="flex h-dvh items-center justify-center bg-canvas p-6"><div className="max-w-md rounded-3xl border border-line bg-panel p-8 text-center shadow-soft"><AlertTriangle className="mx-auto mb-4 h-9 w-9 text-red-500" /><h1 className="text-xl font-semibold text-ink">页面出现了一点问题</h1><p className="mt-2 text-sm text-muted">请重试；如果问题持续存在，请检查服务端配置和日志。</p><Button variant="primary" className="mt-6" onClick={reset}>重新加载</Button></div></div>;
}
