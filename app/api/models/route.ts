import { NextRequest } from "next/server";
import { fallbackModels, sortModels } from "@/lib/model-utils";
import { getBaseUrl, upstreamHeaders } from "@/lib/server/upstream";
import { apiKeyForSession, sessionFromRequest } from "@/lib/server/auth";
import type { ModelInfo, ModelsResponse } from "@/types/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const caches = new Map<number, { data: ModelsResponse; expiresAt: number }>();
const CACHE_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const session = await sessionFromRequest(request);
  const slot = session?.keySlot ?? 1;
  const cached = caches.get(slot);
  if (cached && Date.now() < cached.expiresAt) return Response.json(cached.data);

  try {
    const response = await fetch(`${getBaseUrl()}/models`, {
      headers: upstreamHeaders(apiKeyForSession(session)),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`models ${response.status}`);
    const payload = (await response.json()) as { data?: Array<{ id?: unknown; owned_by?: unknown }> };
    const models: ModelInfo[] = (payload.data ?? [])
      .filter((model): model is { id: string; owned_by?: unknown } => typeof model.id === "string")
      .map((model) => ({ id: model.id, ownedBy: typeof model.owned_by === "string" ? model.owned_by : undefined }));
    if (!models.length) throw new Error("empty models list");
    const data: ModelsResponse = { data: sortModels(models), source: "upstream" };
    caches.set(slot, { data, expiresAt: Date.now() + CACHE_MS });
    return Response.json(data);
  } catch (error) {
    console.error("Load models failed, using fallback", error);
    const data: ModelsResponse = {
      data: fallbackModels(),
      source: "fallback",
      warning: "模型列表获取失败，已使用内置默认列表",
    };
    caches.set(slot, { data, expiresAt: Date.now() + 60_000 });
    return Response.json(data);
  }
}
