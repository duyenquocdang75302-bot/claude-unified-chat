type StreamCallbacks = {
  onToken: (token: string) => void;
  onFinish?: (reason: string | null) => void;
};

export class ChatStreamError extends Error {
  code?: string;
  retryable: boolean;

  constructor(message: string, options?: { code?: string; retryable?: boolean }) {
    super(message);
    this.name = "ChatStreamError";
    this.code = options?.code;
    this.retryable = options?.retryable === true;
  }
}

export function isRecoverableChatStreamError(error: unknown) {
  if (error instanceof ChatStreamError) return error.retryable;
  if (error instanceof TypeError) return true;
  return error instanceof Error && /上游连接中断|请求超时|network|fetch|terminated|socket/i.test(error.message);
}

function extractText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as { choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> }; text?: string; finish_reason?: string | null }> };
  const choice = data.choices?.[0];
  const content = choice?.delta?.content ?? choice?.text ?? "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? "").join("");
  return "";
}

function extractError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as { error?: string | { message?: string; code?: string; retryable?: boolean } };
  if (typeof data.error === "string") {
    return {
      message: data.error,
      retryable: /上游连接中断|请求超时/i.test(data.error),
    };
  }
  if (!data.error?.message) return null;
  return {
    message: data.error.message,
    code: data.error.code,
    retryable: data.error.retryable === true,
  };
}

export async function consumeChatStream(response: Response, callbacks: StreamCallbacks) {
  if (!response.body) throw new Error("响应中没有可读取的数据流");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? "" : lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data) continue;
      if (data === "[DONE]") {
        completed = true;
        continue;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        // Some compatible providers send keep-alive data that is not JSON.
        continue;
      }
      const error = extractError(payload);
      if (error) throw new ChatStreamError(error.message, error);
      const finishReason = (payload as { choices?: Array<{ finish_reason?: string | null }> }).choices?.[0]?.finish_reason;
      if (finishReason !== undefined) {
        callbacks.onFinish?.(finishReason ?? null);
        if (finishReason) completed = true;
      }
      callbacks.onToken(extractText(payload));
    }
    if (done) break;
  }

  if (!completed) {
    throw new ChatStreamError("上游连接在回复完成前中断", {
      code: "UPSTREAM_STREAM_INCOMPLETE",
      retryable: true,
    });
  }
}
