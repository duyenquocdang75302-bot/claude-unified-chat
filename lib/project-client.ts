import type { ChatProject } from "@/types/chat";

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error || "统一项目请求失败";
}

export async function fetchSharedProjects() {
  const response = await fetch("/api/project", { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { projects?: ChatProject[]; project?: ChatProject | null };
  return body.projects ?? (body.project ? [body.project] : []);
}

export async function saveSharedProject(project: ChatProject) {
  const response = await fetch("/api/project", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { project?: ChatProject };
  if (!body.project) throw new Error("统一项目保存失败");
  return body.project;
}

export async function deleteSharedProject(id?: string) {
  const response = await fetch(id ? `/api/project?id=${encodeURIComponent(id)}` : "/api/project", { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response));
}
