import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  authenticateCredentials,
  createSessionToken,
  isAuthenticationEnabled,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; resetsAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export async function POST(request: NextRequest) {
  if (!isAuthenticationEnabled()) return Response.json({ ok: true });
  const address =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const now = Date.now();
  const previous = attempts.get(address);
  const state = !previous || previous.resetsAt <= now ? { count: 0, resetsAt: now + WINDOW_MS } : previous;
  if (state.count >= MAX_ATTEMPTS) {
    return Response.json({ error: "登录尝试过多，请稍后再试" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  if (!body?.username || !body.password) {
    return Response.json({ error: "请输入账号和密码" }, { status: 400 });
  }
  const account = await authenticateCredentials(body.username, body.password);
  if (!account) {
    state.count += 1;
    attempts.set(address, state);
    return Response.json({ error: "账号或密码错误" }, { status: 401 });
  }

  attempts.delete(address);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, await createSessionToken(account), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
