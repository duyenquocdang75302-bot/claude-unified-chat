import { NextRequest } from "next/server";
import { sessionFromRequest } from "@/lib/server/auth";
import { deleteSharedProject, getSharedProject, saveSharedProject } from "@/lib/server/shared-project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await sessionFromRequest(request))) return Response.json({ error: "请先登录账号" }, { status: 401 });
  try {
    return Response.json({ project: await getSharedProject() });
  } catch (error) {
    console.error("Load shared project failed", error);
    return Response.json({ error: "统一项目暂时无法读取" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) return Response.json({ error: "请先登录账号" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "只有管理员可以修改统一项目" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { project?: unknown } | null;
  try {
    return Response.json({ project: await saveSharedProject(body?.project ?? body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "统一项目保存失败";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) return Response.json({ error: "请先登录账号" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "只有管理员可以删除统一项目" }, { status: 403 });
  try {
    await deleteSharedProject();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Delete shared project failed", error);
    return Response.json({ error: "统一项目删除失败" }, { status: 500 });
  }
}
