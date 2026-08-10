"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, LoaderCircle, Paperclip, Square } from "lucide-react";
import { AttachmentBar } from "@/components/attachments/AttachmentBar";
import { Button } from "@/components/ui/Button";
import type { DocumentAttachment, ImageAttachment } from "@/types/chat";

export function ChatComposer({ initialPrompt, images, documents, parsing, generating, onAddFiles, onRemoveImage, onRemoveDocument, onSend, onStop }: {
  initialPrompt: string;
  images: ImageAttachment[];
  documents: DocumentAttachment[];
  parsing: boolean;
  generating: boolean;
  onAddFiles: (files: File[] | FileList) => Promise<void>;
  onRemoveImage: (id: string) => void;
  onRemoveDocument: (id: string) => void;
  onSend: (content: string) => Promise<boolean>;
  onStop: () => void;
}) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (initialPrompt) { setContent(initialPrompt); textareaRef.current?.focus(); } }, [initialPrompt]);
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "0";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [content]);

  const submit = async () => {
    if (parsing || generating) return;
    const sent = await onSend(content);
    if (sent) setContent("");
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-3 sm:px-6 sm:pb-5">
      <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-soft focus-within:border-accent/60">
        <AttachmentBar images={images} documents={documents} parsing={parsing} onRemoveImage={onRemoveImage} onRemoveDocument={onRemoveDocument} />
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
            if (files.length) { event.preventDefault(); void onAddFiles(files); }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); }
          }}
          rows={1}
          className="block max-h-[200px] min-h-[52px] w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-6 text-ink outline-none placeholder:text-muted/70"
          placeholder="输入消息，粘贴截图，或拖入图片和文档…"
          aria-label="聊天输入框"
        />
        <div className="flex items-center justify-between px-2.5 pb-2.5">
          <div>
            <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,.txt,.md,.pdf,.docx,.csv,.json,.js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.rb,.php,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.sh,.sql,.yaml,.yml,.xml,.html,.css" onChange={(event) => { if (event.target.files) void onAddFiles(event.target.files); event.currentTarget.value = ""; }} />
            <Button size="icon" variant="ghost" onClick={() => fileRef.current?.click()} disabled={parsing || generating} aria-label="添加图片或文件"><Paperclip className="h-5 w-5" /></Button>
          </div>
          {generating ? (
            <Button size="icon" variant="primary" onClick={onStop} aria-label="停止生成"><Square className="h-4 w-4 fill-current" /></Button>
          ) : (
            <Button size="icon" variant="primary" onClick={() => void submit()} disabled={parsing || (!content.trim() && !images.length && !documents.length)} aria-label="发送消息">{parsing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" />}</Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">AI 可能会出错，请核实重要信息。Enter 发送，Shift + Enter 换行。</p>
    </div>
  );
}
