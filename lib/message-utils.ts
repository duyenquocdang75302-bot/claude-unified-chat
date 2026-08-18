import type { ChatMessage } from "@/types/chat";

// Old long answers are the least useful context and can make the upstream wait too
// long before producing its first token. Project instructions are handled separately.
const MAX_UPSTREAM_HISTORY_CHARACTERS = 60_000;

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

function messageCharacterCost(message: ChatMessage) {
  return message.content.length +
    (message.documents?.reduce((sum, file) => sum + file.content.length, 0) ?? 0);
}

export function recentMessagesForUpstream(
  messages: ChatMessage[],
  maximumCharacters = MAX_UPSTREAM_HISTORY_CHARACTERS,
) {
  const candidates = messages.filter((message) => message.status !== "error");
  if (!candidates.length) return [];

  const selected: ChatMessage[] = [];
  let remaining = maximumCharacters;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const message = candidates[index];
    const cost = messageCharacterCost(message);
    // The newest message is always required. Older oversized messages are skipped
    // instead of pushing the current user request out of the context window.
    if (!selected.length || cost <= remaining) {
      selected.unshift(message);
      remaining = Math.max(0, remaining - cost);
    }
  }

  const firstUserIndex = selected.findIndex((message) => message.role === "user");
  return firstUserIndex > 0 ? selected.slice(firstUserIndex) : selected;
}

export function toUpstreamMessages(messages: ChatMessage[]) {
  const includedMessages = recentMessagesForUpstream(messages);
  let latestAttachmentIndex = -1;
  for (let index = includedMessages.length - 1; index >= 0; index -= 1) {
    const message = includedMessages[index];
    if (message.role === "user") {
      // Attachments belong only to the newest user turn. A later text follow-up or
      // automatic continuation must not resend old base64 images/documents.
      if (message.images?.length || message.documents?.length) latestAttachmentIndex = index;
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
