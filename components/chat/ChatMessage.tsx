"use client";

import { memo, useState } from "react";
import { Bot, Check, Copy, Pencil, RefreshCw, Trash2, User, X } from "lucide-react";
import { MessageContent } from "@/components/chat/MessageContent";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/contexts/ToastContext";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy failed");
}

export const ChatMessage = memo(function ChatMessage({ message, generating, onEdit, onDelete, onRegenerate, onContinue }: {
  message: ChatMessageType;
  generating: boolean;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onContinue: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const { notify } = useToast();
  const isUser = message.role === "user";
  const handleCopy = async () => {
    try {
      await copyToClipboard(message.content);
      setCopied(true);
      notify("AI 回复已复制", "success");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      notify("复制失败，请重试", "error");
    }
  };
  return (
    <article className={`group mx-auto flex w-full max-w-4xl gap-3 px-4 py-5 sm:gap-4 sm:px-6 ${isUser ? "" : "rounded-2xl bg-muted/[0.045]"}`}>
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isUser ? "bg-ink text-canvas" : "bg-accent text-white"}`}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="relative min-w-0 flex-1 pr-10">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted"><span>{isUser ? "你" : "AI"}</span>{message.status === "error" ? <span className="text-red-500">生成失败</span> : null}</div>
        {!isUser && message.status !== "streaming" && message.content ? (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            aria-label={copied ? "已复制 AI 回复" : "复制 AI 回复"}
            title={copied ? "已复制" : "复制全文"}
            className="absolute right-0 top-0 h-8 w-8"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        ) : null}
        {editing ? (
          <div className="space-y-2">
            <textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-28 w-full rounded-xl border border-line bg-panel p-3 text-sm text-ink outline-none focus:border-accent" />
            <div className="flex gap-2"><Button size="sm" variant="primary" onClick={() => { onEdit(draft); setEditing(false); }}><Check className="h-3.5 w-3.5" />保存</Button><Button size="sm" variant="ghost" onClick={() => { setDraft(message.content); setEditing(false); }}><X className="h-3.5 w-3.5" />取消</Button></div>
          </div>
        ) : (
          <MessageContent content={message.content || (message.status === "streaming" ? "正在思考…" : "")} images={message.images} streaming={message.status === "streaming"} />
        )}
        {message.documents?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.documents.map((file) => <span key={file.id} className="rounded-lg border border-line bg-panel px-2 py-1 text-[11px] text-muted">📄 {file.name}{file.truncated ? "（已截断）" : ""}</span>)}</div> : null}
        {message.error ? <p className="mt-3 text-sm text-red-500">{message.error}</p> : null}
        {message.finishReason === "length" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-amber-600">
            <span>输出已达到最大 Tokens 限制，请继续生成剩余内容。</span>
            <Button size="sm" variant="ghost" onClick={onContinue} disabled={generating}>继续生成</Button>
          </div>
        ) : null}
        {!editing && message.status !== "streaming" ? (
          <div className="mt-3 flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={generating}><Pencil className="h-3.5 w-3.5" />编辑</Button>
            {!isUser ? <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={generating}><RefreshCw className="h-3.5 w-3.5" />重新生成</Button> : null}
            <Button size="sm" variant="danger" onClick={onDelete} disabled={generating}><Trash2 className="h-3.5 w-3.5" />删除</Button>
          </div>
        ) : null}
      </div>
    </article>
  );
});
