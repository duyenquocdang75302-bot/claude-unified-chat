"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChatMessage } from "@/components/chat/ChatMessage";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

export function MessageList({ messages, generating, onEdit, onDelete, onRegenerate }: {
  messages: ChatMessageType[];
  generating: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 190,
    overscan: 4,
  });
  const last = messages[messages.length - 1];
  useEffect(() => {
    if (messages.length) virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    // Content length triggers measured scrolling while streaming without updating every token in dependencies.
  }, [messages.length, last?.content.length, virtualizer]);

  return (
    <div ref={parentRef} className="h-full overflow-y-auto overscroll-contain" aria-live="polite">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const message = messages[row.index];
          return (
            <div key={message.id} ref={virtualizer.measureElement} data-index={row.index} className="absolute left-0 top-0 w-full" style={{ transform: `translateY(${row.start}px)` }}>
              <ChatMessage message={message} generating={generating} onEdit={(content) => onEdit(message.id, content)} onDelete={() => onDelete(message.id)} onRegenerate={() => onRegenerate(message.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
