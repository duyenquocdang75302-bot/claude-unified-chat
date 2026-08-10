import { Bot, FileText, Image as ImageIcon, Sparkles } from "lucide-react";

export function EmptyChat({ model, onPrompt }: { model: string; onPrompt: (prompt: string) => void }) {
  const examples = ["帮我分析一个复杂问题", "解释这段代码并给出优化建议", "总结我上传的文档"];
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-soft"><Bot className="h-7 w-7" /></div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">今天想聊些什么？</h1>
        <p className="mt-2 text-sm text-muted">当前模型：{model}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {examples.map((example, index) => <button key={example} onClick={() => onPrompt(example)} className="rounded-2xl border border-line bg-panel p-4 text-left text-sm text-ink transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-soft">{index === 0 ? <Sparkles className="mb-3 h-5 w-5 text-accent" /> : index === 1 ? <ImageIcon className="mb-3 h-5 w-5 text-accent" /> : <FileText className="mb-3 h-5 w-5 text-accent" />}{example}</button>)}
        </div>
      </div>
    </div>
  );
}
