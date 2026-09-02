import { NextRequest } from "next/server";
import { friendlyUpstreamError, isTimeoutError } from "@/lib/server/api-errors";
import { getBaseUrl, upstreamHeaders } from "@/lib/server/upstream";
import { apiKeyForSession, sessionFromRequest } from "@/lib/server/auth";
import { recordUsage } from "@/lib/server/usage";
import { UpstreamTokenTracker } from "@/lib/server/token-tracker";
import { getSharedProject } from "@/lib/server/shared-project";
import { isSharedProjectId, UPSTREAM_MAX_TOKENS_PER_REQUEST } from "@/lib/constants";
import { mergeProjectSystemPrompt } from "@/lib/project-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby allows a maximum of 300 seconds for a serverless function.
export const maxDuration = 300;

const FIRST_RESPONSE_TIMEOUT_MS = 180_000;
const STREAM_IDLE_TIMEOUT_MS = 180_000;

export async function POST(request: NextRequest) {
  const controller = new AbortController();
  let timeout = setTimeout(() => controller.abort("timeout"), FIRST_RESPONSE_TIMEOUT_MS);
  const resetStreamTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => controller.abort("timeout"), STREAM_IDLE_TIMEOUT_MS);
  };
  const onClientAbort = () => controller.abort("client-aborted");
  request.signal.addEventListener("abort", onClientAbort, { once: true });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const session = await sessionFromRequest(request);
    if (!session) {
      clearTimeout(timeout);
      return Response.json({ error: "请先登录账号" }, { status: 401 });
    }
    if (typeof body.model !== "string" || !Array.isArray(body.messages)) {
      clearTimeout(timeout);
      return Response.json({ error: "请求参数不完整" }, { status: 400 });
    }

    const messages = [...body.messages];
    let systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt.trim() : "";
    if (typeof body.projectId === "string" && isSharedProjectId(body.projectId)) {
      const project = await getSharedProject(body.projectId);
      if (project) systemPrompt = mergeProjectSystemPrompt(project, body.model, systemPrompt);
    }
    if (systemPrompt) {
      messages.unshift({ role: "system", content: systemPrompt });
    }

    const streaming = body.stream !== false;
    const requestBody: Record<string, unknown> = {
      model: body.model,
      messages,
      temperature: body.temperature,
      max_tokens: Math.min(
        UPSTREAM_MAX_TOKENS_PER_REQUEST,
        Math.max(1, Number.isFinite(body.max_tokens) ? Number(body.max_tokens) : UPSTREAM_MAX_TOKENS_PER_REQUEST),
      ),
      stream: streaming,
    };
    if (streaming) requestBody.stream_options = { include_usage: true };

    const apiKey = apiKeyForSession(session);
    const sendUpstream = () =>
      fetch(`${getBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: upstreamHeaders(apiKey),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        cache: "no-store",
      });

    const upstreamStartedAt = Date.now();
    let upstream = await sendUpstream();
    let upstreamErrorDetail = "";
    if (!upstream.ok) {
      upstreamErrorDetail = await upstream.text().catch(() => "");
      const usageOptionUnsupported =
        streaming &&
        upstream.status === 400 &&
        /stream_options|include_usage/i.test(upstreamErrorDetail);
      if (usageOptionUnsupported) {
        delete requestBody.stream_options;
        upstream = await sendUpstream();
        if (!upstream.ok) upstreamErrorDetail = await upstream.text().catch(() => "");
      }
    }

    if (!upstream.ok) {
      clearTimeout(timeout);
      console.error("Upstream chat error", {
        status: upstream.status,
        durationMs: Date.now() - upstreamStartedAt,
        model: body.model,
        messageCount: messages.length,
        requestBytes: Buffer.byteLength(JSON.stringify(requestBody)),
        maxTokens: requestBody.max_tokens,
        attempt: request.headers.get("x-chat-attempt") ?? "1",
        detail: upstreamErrorDetail.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240),
      });
      return Response.json(
        { error: friendlyUpstreamError(upstream.status, upstreamErrorDetail) },
        { status: upstream.status },
      );
    }
    if (!upstream.body) {
      clearTimeout(timeout);
      return Response.json({ error: "上游服务未返回数据" }, { status: 502 });
    }

    // The timeout is an inactivity timeout, not a total response limit.
    // Claude can stream long answers for several minutes while remaining healthy.
    resetStreamTimeout();
    const reader = upstream.body.getReader();
    const encoder = new TextEncoder();
    const tokenTracker = new UpstreamTokenTracker(messages);
    let streamedBytes = 0;
    let usageRecorded = false;
    const saveUsage = async () => {
      if (usageRecorded) return;
      usageRecorded = true;
      const usage = tokenTracker.finish(streaming);
      try {
        await recordUsage({
          userId: session.id,
          username: session.username,
          model: body.model as string,
          purpose: body.purpose === "title" ? "title" : "chat",
          ...usage,
        });
      } catch (error) {
        console.error("Save token usage failed", error);
      }
    };
    const stream = new ReadableStream<Uint8Array>({
      async pull(streamController) {
        try {
          const { value, done } = await reader.read();
          if (done) {
            await saveUsage();
            clearTimeout(timeout);
            request.signal.removeEventListener("abort", onClientAbort);
            streamController.close();
          } else if (value) {
            resetStreamTimeout();
            streamedBytes += value.byteLength;
            tokenTracker.push(value, streaming);
            streamController.enqueue(value);
          }
        } catch (error) {
          clearTimeout(timeout);
          request.signal.removeEventListener("abort", onClientAbort);
          await saveUsage();
          if (controller.signal.reason !== "client-aborted" && controller.signal.reason !== "response-cancelled") {
            const timedOut = controller.signal.reason === "timeout";
            const message = timedOut ? "请求超时，系统将自动续接" : "上游连接中断，系统将自动续接";
            console.error("Upstream stream interrupted", {
              model: body.model,
              attempt: request.headers.get("x-chat-attempt") ?? "1",
              streamedBytes,
              reason: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
              timeout: timedOut,
            });
            try {
              streamController.enqueue(encoder.encode(`data: ${JSON.stringify({
                error: {
                  message,
                  code: timedOut ? "UPSTREAM_STREAM_TIMEOUT" : "UPSTREAM_STREAM_INTERRUPTED",
                  retryable: true,
                },
              })}\n\n`));
            } catch {
              // The browser connection may already be gone; the client also
              // recognizes an abruptly closed response as recoverable.
            }
          }
          try {
            streamController.close();
          } catch {
            // Already closed by the runtime or the browser.
          }
        }
      },
      cancel() {
        clearTimeout(timeout);
        controller.abort("response-cancelled");
        void saveUsage();
        void reader.cancel();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    if (controller.signal.reason === "timeout" || isTimeoutError(error)) {
      return Response.json({ error: "请求超时，请重试" }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : "聊天请求失败";
    console.error("Chat proxy error", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
