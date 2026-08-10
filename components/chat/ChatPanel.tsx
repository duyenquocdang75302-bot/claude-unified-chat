"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { EmptyChat } from "@/components/chat/EmptyChat";
import { MessageList } from "@/components/chat/MessageList";
import { useAttachments } from "@/hooks/useAttachments";
import type { Conversation } from "@/types/chat";

export function ChatPanel({ conversation, generating, onSend, onStop, onEdit, onDelete, onRegenerate }: {
  conversation: Conversation;
  generating: boolean;
  onSend: ReturnType<typeof useAttachments> extends never ? never : (content: string, images: ReturnType<typeof useAttachments>["images"], documents: ReturnType<typeof useAttachments>["documents"]) => Promise<boolean>;
  onStop: () => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
}) {
  const attachments = useAttachments(conversation.model);
  const [dragging, setDragging] = useState(false);
  const [prompt, setPrompt] = useState("");
  const send = async (content: string) => {
    const sent = await onSend(content, attachments.images, attachments.documents);
    if (sent) attachments.clear();
    return sent;
  };
  return (
    <main
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) void attachments.addFiles(event.dataTransfer.files); }}
    >
      <div className="min-h-0 flex-1">
        {conversation.messages.length ? (
          <MessageList messages={conversation.messages} generating={generating} onEdit={onEdit} onDelete={onDelete} onRegenerate={onRegenerate} />
        ) : <EmptyChat model={conversation.model} onPrompt={(value) => { setPrompt(""); window.setTimeout(() => setPrompt(value), 0); }} />}
      </div>
      <ChatComposer
        initialPrompt={prompt}
        images={attachments.images}
        documents={attachments.documents}
        parsing={attachments.parsing}
        generating={generating}
        onAddFiles={attachments.addFiles}
        onRemoveImage={attachments.removeImage}
        onRemoveDocument={attachments.removeDocument}
        onSend={send}
        onStop={onStop}
      />
      {dragging ? <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-accent bg-accent/10 backdrop-blur-sm"><div className="rounded-2xl bg-panel px-8 py-6 text-center shadow-soft"><UploadCloud className="mx-auto mb-3 h-8 w-8 text-accent" /><p className="font-medium text-ink">拖到这里上传</p><p className="mt-1 text-xs text-muted">支持图片、PDF、DOCX 和常见文本/代码文件</p></div></div> : null}
    </main>
  );
}
