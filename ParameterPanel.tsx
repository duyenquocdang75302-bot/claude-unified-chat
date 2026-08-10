"use client";

import { X } from "lucide-react";
import type { ChatParameters } from "@/types/chat";
import { Button } from "@/components/ui/Button";

export function ParameterPanel({ parameters, onChange, onClose }: { parameters: ChatParameters; onChange: (parameters: ChatParameters) => void; onClose: () => void }) {
  return (
    <div className="absolute right-4 top-16 z-40 w-[min(92vw,380px)] rounded-2xl border border-line bg-panel p-5 shadow-soft">
      <div className="mb-5 flex items-center justify-between">
        <div><h2 className="font-semibold text-ink">当前会话参数</h2><p className="text-xs text-muted">仅影响当前会话</p></div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="关闭参数面板"><X className="h-4 w-4" /></Button>
      </div>
      <label className="mb-5 block text-sm text-ink">
        <span className="mb-2 flex justify-between"><span>Temperature</span><span className="text-muted">{parameters.temperature.toFixed(1)}</span></span>
        <input className="w-full accent-[rgb(var(--accent))]" type="range" min="0" max="2" step="0.1" value={parameters.temperature} onChange={(event) => onChange({ ...parameters, temperature: Number(event.target.value) })} />
      </label>
      <label className="mb-5 block text-sm text-ink">
        <span className="mb-2 flex justify-between"><span>最大输出 Tokens</span><span className="text-muted">{parameters.maxTokens}</span></span>
        <input className="w-full accent-[rgb(var(--accent))]" type="range" min="1024" max="16384" step="1024" value={parameters.maxTokens} onChange={(event) => onChange({ ...parameters, maxTokens: Number(event.target.value) })} />
      </label>
      <label className="block text-sm text-ink">
        <span className="mb-2 block">系统提示词</span>
        <textarea className="min-h-28 w-full resize-y rounded-xl border border-line bg-canvas p-3 text-sm outline-none focus:border-accent" value={parameters.systemPrompt} onChange={(event) => onChange({ ...parameters, systemPrompt: event.target.value })} placeholder="例如：你是一名严谨的编程助手……" />
      </label>
    </div>
  );
}
