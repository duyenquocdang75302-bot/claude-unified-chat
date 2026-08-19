import type { ChatMessage, Conversation } from "@/types/chat";
import { toUpstreamMessages } from "@/lib/message-utils";
import { MAX_CHAT_REQUEST_BYTES, UPSTREAM_MAX_TOKENS_PER_REQUEST } from "@/lib/constants";
import { chatRetryDelayMs, exhaustedChatError } from "@/lib/chat-request-policy";

function waitForRetry(signal: AbortSignal, delayMs: number) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function requestChat(
  conversation: Conversation,
  messages: ChatMessage[],
  signal: AbortSignal,
) {
  const requestBody = JSON.stringify({
    model: conversation.model,
    messages: toUpstreamMessages(messages),
    temperature: conversation.parameters.temperature,
    max_tokens: Math.min(conversation.parameters.maxTokens, UPSTREAM_MAX_TOKENS_PER_REQUEST),
    systemPrompt: conversation.parameters.systemPrompt,
    projectId: conversation.projectId ?? null,
    stream: true,
  });
  const requestBytes = new TextEncoder().encode(requestBody).byteLength;
  if (requestBytes > MAX_CHAT_REQUEST_BYTES) {
    throw new Error(
      `请求内容 ${(requestBytes / 1024 / 1024).toFixed(1)}MB 过大，请减少本次图片或文件数量后重试`,
    );
  }

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Chat-Attempt": String(attempt + 1),
      },
      body: requestBody,
      signal,
    });

    if (response.ok) return response;
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    const retryDelayMs = chatRetryDelayMs(response.status, attempt);
    if (retryDelayMs !== null && !signal.aborted) {
      await waitForRetry(signal, retryDelayMs);
      continue;
    }
    const exhaustedError = exhaustedChatError(response.status);
    if (exhaustedError) throw new Error(exhaustedError);
    throw new Error(body?.error || `请求失败（${response.status}）`);
  }
}

function conversationTextForTitle(messages: ChatMessage[]) {
  return messages
    .slice(0, 8)
    .map((message) => {
      const role = message.role === "user" ? "用户" : "AI";
      const attachments = [
        ...(message.images?.map((image) => `图片：${image.name}`) ?? []),
        ...(message.documents?.map((document) => `文件：${document.name}`) ?? []),
      ];
      const content = [message.content.trim(), ...attachments].filter(Boolean).join("\n");
      return content ? `${role}：${content}` : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);
}

function cleanConversationTitle(value: string) {
  return value
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/```$/i, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^#{1,6}\s*/, "")
    .replace(/^(?:标题|对话标题)\s*[：:]\s*/, "")
    .replace(/^["“'‘《【]+|["”'’》】]+$/g, "")
    .replace(/[。！？!?，,：:；;、]+$/g, "")
    .trim()
    .slice(0, 20) ?? "";
}

export async function requestConversationTitle(model: string, messages: ChatMessage[]) {
  const conversationText = conversationTextForTitle(messages);
  if (!conversationText) return "";

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "请根据对话内容生成一个简洁准确、方便识别的中文标题。标题应概括核心主题，8到16个汉字；不要使用引号、结尾标点、前缀或解释，只输出标题。",
        },
        {
          role: "user",
          content: conversationText,
        },
      ],
      temperature: 0.2,
      max_tokens: 48,
      stream: false,
      purpose: "title",
    }),
  });

  if (!response.ok) {
    throw new Error("生成对话标题失败");
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return cleanConversationTitle(body.choices?.[0]?.message?.content ?? "");
}
