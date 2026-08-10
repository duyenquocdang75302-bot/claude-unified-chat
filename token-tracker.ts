type UsageSnapshot = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
};

function estimateTokens(value: string) {
  let ascii = 0;
  let nonAscii = 0;
  for (const character of value) {
    if (character.charCodeAt(0) <= 0x7f) ascii += 1;
    else nonAscii += 1;
  }
  return Math.max(1, Math.ceil(ascii / 4 + nonAscii / 1.5));
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const block = item as { type?: unknown; text?: unknown };
      return block.type === "text" && typeof block.text === "string" ? block.text : "";
    })
    .join("");
}

export class UpstreamTokenTracker {
  private readonly decoder = new TextDecoder();
  private readonly inputText: string;
  private buffer = "";
  private rawBody = "";
  private responseText = "";
  private exactUsage: UsageSnapshot | null = null;

  constructor(messages: unknown) {
    this.inputText = JSON.stringify(messages);
  }

  push(value: Uint8Array, streaming: boolean) {
    const text = this.decoder.decode(value, { stream: true });
    if (!streaming) {
      this.rawBody += text;
      return;
    }
    this.buffer += text;
    this.processSseLines(false);
  }

  finish(streaming: boolean): UsageSnapshot {
    const tail = this.decoder.decode();
    if (streaming) {
      this.buffer += tail;
      this.processSseLines(true);
    } else {
      this.rawBody += tail;
      this.processJson(this.rawBody);
    }
    if (this.exactUsage) return this.exactUsage;
    const promptTokens = estimateTokens(this.inputText);
    const completionTokens = estimateTokens(this.responseText || " ");
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimated: true,
    };
  }

  private processSseLines(flush: boolean) {
    const lines = this.buffer.split(/\r?\n/);
    const remaining = lines.pop() ?? "";
    this.buffer = flush ? "" : remaining;
    if (flush && remaining.trim()) lines.push(remaining);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      this.processJson(data);
    }
  }

  private processJson(value: string) {
    try {
      const payload = JSON.parse(value) as {
        usage?: {
          prompt_tokens?: unknown;
          completion_tokens?: unknown;
          total_tokens?: unknown;
          input_tokens?: unknown;
          output_tokens?: unknown;
        };
        choices?: Array<{
          delta?: { content?: unknown };
          message?: { content?: unknown };
          text?: unknown;
        }>;
      };
      const usage = payload.usage;
      if (usage) {
        const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
        const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
        const totalTokens = Number(usage.total_tokens ?? promptTokens + completionTokens);
        if (Number.isFinite(totalTokens) && totalTokens > 0) {
          this.exactUsage = {
            promptTokens: Math.max(0, promptTokens),
            completionTokens: Math.max(0, completionTokens),
            totalTokens: Math.max(0, totalTokens),
            estimated: false,
          };
        }
      }
      for (const choice of payload.choices ?? []) {
        this.responseText +=
          textContent(choice.delta?.content) ||
          textContent(choice.message?.content) ||
          textContent(choice.text);
      }
    } catch {
      // 非 JSON 的上游事件不影响正文转发。
    }
  }
}
