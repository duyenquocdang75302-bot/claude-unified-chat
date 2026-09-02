import assert from "node:assert/strict";
import test from "node:test";
import {
  ChatStreamError,
  consumeChatStream,
  isRecoverableChatStreamError,
} from "./chat-stream.ts";

function streamResponse(events) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  }), { headers: { "content-type": "text/event-stream" } });
}

test("keeps partial tokens and exposes a structured recoverable stream error", async () => {
  let text = "";
  const response = streamResponse([
    'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n',
    'data: {"error":{"message":"上游连接中断，系统将自动续接","code":"UPSTREAM_STREAM_INTERRUPTED","retryable":true}}\n\n',
  ]);

  await assert.rejects(
    consumeChatStream(response, { onToken: (token) => { text += token; } }),
    (error) =>
      error instanceof ChatStreamError &&
      error.code === "UPSTREAM_STREAM_INTERRUPTED" &&
      isRecoverableChatStreamError(error),
  );
  assert.equal(text, "partial");
});

test("treats a silently incomplete SSE response as recoverable", async () => {
  const response = streamResponse([
    'data: {"choices":[{"delta":{"content":"unfinished"},"finish_reason":null}]}\n\n',
  ]);

  await assert.rejects(
    consumeChatStream(response, { onToken() {} }),
    (error) => error instanceof ChatStreamError && error.code === "UPSTREAM_STREAM_INCOMPLETE",
  );
});

test("accepts a normally completed stream", async () => {
  let text = "";
  let finishReason = null;
  const response = streamResponse([
    'data: {"choices":[{"delta":{"content":"done"},"finish_reason":null}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    'data: [DONE]\n\n',
  ]);

  await consumeChatStream(response, {
    onToken: (token) => { text += token; },
    onFinish: (reason) => { finishReason = reason; },
  });
  assert.equal(text, "done");
  assert.equal(finishReason, "stop");
});
