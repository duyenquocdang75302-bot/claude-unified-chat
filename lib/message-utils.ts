import type { ChatMessage } from "@/types/chat";

export function messageTextWithDocuments(message: ChatMessage) {
  const blocks = [message.content.trim()];
  for (const file of message.documents ?? []) {
    blocks.push(`[文件: ${file.name}]\n${file.content}\n[文件结束]`);
  }
  return blocks.filter(Boolean).join("\n\n");
}

export function toUpstreamMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.status !== "error")
    .map((message) => {
      if (message.role === "assistant") return { role: "assistant" as const, content: message.content };
      const text = messageTextWithDocuments(message);
      if (!message.images?.length) return { role: "user" as const, content: text };
      return {
        role: "user" as const,
        content: [
          { type: "text" as const, text: text || "请分析这些图片。" },
          ...message.images.map((image) => ({
            type: "image_url" as const,
            image_url: { url: image.dataUrl },
          })),
        ],
      };
    });
}
