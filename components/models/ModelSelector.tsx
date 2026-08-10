"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { isClaudeModel } from "@/lib/model-utils";
import type { ModelInfo } from "@/types/model";

export function ModelSelector({ model, models, loading, onChange }: { model: string; models: ModelInfo[]; loading: boolean; onChange: (model: string) => void }) {
  const [custom, setCustom] = useState(false);
  const [customId, setCustomId] = useState(model);
  const known = useMemo(() => models.some((item) => item.id === model), [models, model]);
  useEffect(() => { if (!known) { setCustom(true); setCustomId(model); } }, [known, model]);
  const claude = models.filter((item) => isClaudeModel(item.id));
  const others = models.filter((item) => !isClaudeModel(item.id));

  if (custom) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <input
          autoFocus
          value={customId}
          onChange={(event) => setCustomId(event.target.value)}
          onBlur={() => { if (customId.trim()) onChange(customId.trim()); }}
          onKeyDown={(event) => { if (event.key === "Enter" && customId.trim()) { onChange(customId.trim()); event.currentTarget.blur(); } }}
          className="h-9 min-w-0 w-48 rounded-xl border border-line bg-panel px-3 text-sm text-ink outline-none focus:border-accent"
          aria-label="自定义模型 ID"
          placeholder="输入模型 ID"
        />
        <button className="text-xs text-muted hover:text-ink" onClick={() => setCustom(false)}>列表</button>
      </div>
    );
  }

  return (
    <div className="relative min-w-0">
      {loading ? <LoaderCircle className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 animate-spin text-muted" /> : null}
      <select
        value={known ? model : "__custom"}
        onChange={(event) => {
          if (event.target.value === "__custom") { setCustom(true); setCustomId(""); }
          else onChange(event.target.value);
        }}
        className="h-9 max-w-[58vw] appearance-none rounded-xl border border-line bg-panel py-0 pl-9 pr-9 text-sm font-medium text-ink outline-none hover:border-muted focus:border-accent sm:max-w-xs"
        aria-label="选择模型"
      >
        <optgroup label="Claude 系列">
          {claude.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
        </optgroup>
        <optgroup label="其他模型">
          {others.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
        </optgroup>
        <option value="__custom">自定义模型 ID…</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted" />
    </div>
  );
}
