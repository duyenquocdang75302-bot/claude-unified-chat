import type { Conversation } from "@/types/chat";
import { messageTextWithDocuments } from "@/lib/message-utils";

export function exportConversation(conversation: Conversation) {
  const lines = [`# ${conversation.title}`, "", `> 模型：${conversation.model}`, ""];
  for (const message of conversation.messages) {
    lines.push(`## ${message.role === "user" ? "用户" : "AI"}`, "", messageTextWithDocuments(message), "");
    for (const image of message.images ?? []) lines.push(`![${image.name}](${image.dataUrl})`, "");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${conversation.title.replace(/[\\/:*?"<>|]/g, "-") || "conversation"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
