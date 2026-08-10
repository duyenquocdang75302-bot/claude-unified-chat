type StreamCallbacks = {
  onToken: (token: string) => void;
};

function extractText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as { choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> }; text?: string }> };
  const choice = data.choices?.[0];
  const content = choice?.delta?.content ?? choice?.text ?? "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? "").join("");
  return "";
}

function extractError(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as { error?: string | { message?: string } };
  if (typeof data.error === "string") return data.error;
  return data.error?.message ?? "";
}

export async function consumeChatStream(response: Response, callbacks: StreamCallbacks) {
  if (!response.body) throw new Error("响应中没有可读取的数据流");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? "" : lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        // Some compatible providers send keep-alive data that is not JSON.
        continue;
      }
      const error = extractError(payload);
      if (error) throw new Error(error);
      callbacks.onToken(extractText(payload));
    }
    if (done) break;
  }
}
