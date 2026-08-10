import { NextRequest } from "next/server";
import { sessionFromRequest } from "@/lib/server/auth";
import { getUsageDashboard } from "@/lib/server/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) return Response.json({ error: "请先登录账号" }, { status: 401 });
  if (session.role !== "admin") {
    return Response.json({ error: "仅管理员可以查看用量统计" }, { status: 403 });
  }
  try {
    return Response.json(await getUsageDashboard());
  } catch (error) {
    console.error("Load usage dashboard failed", error);
    return Response.json({ error: "用量统计暂时不可用，请稍后重试" }, { status: 500 });
  }
}
