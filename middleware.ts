import { NextRequest, NextResponse } from "next/server";
import { isAuthenticationEnabled, sessionFromRequest } from "@/lib/server/auth";

export async function middleware(request: NextRequest) {
  if (!isAuthenticationEnabled()) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const session = await sessionFromRequest(request);
  if (session) {
    const adminPath = path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/");
    if (!adminPath || session.role === "admin") return NextResponse.next();
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "仅管理员可以查看用量统计" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "请先登录账号" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
