import type { ChatMessage } from "@/types/chat";

export function messageTextWithDocuments(message: ChatMessage) {
  const blocks = [message.content.trim()];
  for (const file of message.documents ?? []) {
    blocks.push(`[文件: ${file.name}]\n${file.content}\n[文件结束]`);
  }
  return blocks.filter(Boolean).join("\n\n");
}

function messageTextWithAttachmentReferences(message: ChatMessage) {
  const blocks = [message.content.trim()];
  if (message.images?.length) {
    blocks.push(`[此前上传的图片: ${message.images.map((image) => image.name).join(", ")}]`);
  }
  if (message.documents?.length) {
    blocks.push(`[此前上传的文件: ${message.documents.map((file) => file.name).join(", ")}]`);
  }
  return blocks.filter(Boolean).join("\n\n");
}

export function toUpstreamMessages(messages: ChatMessage[]) {
  const includedMessages = messages.filter((message) => message.status !== "error");
  let latestAttachmentIndex = -1;
  for (let index = includedMessages.length - 1; index >= 0; index -= 1) {
    const message = includedMessages[index];
    if (message.role === "user" && (message.images?.length || message.documents?.length)) {
      latestAttachmentIndex = index;
      break;
    }
  }

  return includedMessages.map((message, index) => {
      if (message.role === "assistant") return { role: "assistant" as const, content: message.content };
      const includeAttachments = index === latestAttachmentIndex;
      const text = includeAttachments
        ? messageTextWithDocuments(message)
        : messageTextWithAttachmentReferences(message);
      if (!includeAttachments || !message.images?.length) {
        return { role: "user" as const, content: text };
      }
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
