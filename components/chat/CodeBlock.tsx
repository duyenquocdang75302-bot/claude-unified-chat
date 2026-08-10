"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");
  const language = /language-([^ ]+)/.exec(className ?? "")?.[1] ?? "code";
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-700 bg-[#111827] text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2 text-xs text-slate-400">
        <span>{language}</span><button onClick={copy} className="flex items-center gap-1.5 hover:text-white">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "已复制" : "复制"}</button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-6"><code className={className}>{children}</code></pre>
    </div>
  );
}
