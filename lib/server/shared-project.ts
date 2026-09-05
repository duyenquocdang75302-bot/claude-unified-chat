import { DEFAULT_MODEL, SHARED_PROJECT_ID } from "@/lib/constants";
import { normalizeProjectTime } from "@/lib/project-time";
import { hasPersistentKv, isProductionRuntime, kvCommand } from "@/lib/server/kv";
import type { ChatProject, ChatParameters, DocumentAttachment } from "@/types/chat";

const SHARED_PROJECTS_KEY = "claude-unified-chat:shared-projects";
const LEGACY_SHARED_PROJECT_KEY = "claude-unified-chat:shared-project";
let memoryProjects: ChatProject[] = [];

function isDocument(value: unknown): value is DocumentAttachment {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DocumentAttachment>;
  return typeof item.id === "string" && typeof item.name === "string" && typeof item.mimeType === "string" &&
    typeof item.size === "number" && typeof item.content === "string" && typeof item.truncated === "boolean";
}

function normalizeParameters(value: unknown): ChatParameters {
  const input = value && typeof value === "object" ? (value as Partial<ChatParameters>) : {};
  return {
    temperature: Math.min(2, Math.max(0, Number.isFinite(input.temperature) ? Number(input.temperature) : 0.7)),
    maxTokens: Math.min(16384, Math.max(256, Number.isFinite(input.maxTokens) ? Number(input.maxTokens) : 8192)),
    systemPrompt: typeof input.systemPrompt === "string" ? input.systemPrompt.slice(0, 30000) : "",
  };
}

export function normalizeSharedProject(value: unknown): ChatProject | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<ChatProject>;
  if (typeof input.name !== "string" || !input.name.trim()) return null;
  const now = Date.now();
  const rawId = typeof input.id === "string" ? input.id.trim() : "";
  const id = rawId === SHARED_PROJECT_ID || rawId.startsWith(`${SHARED_PROJECT_ID}:`)
    ? rawId
    : SHARED_PROJECT_ID;
  const createdAt = normalizeProjectTime(input.createdAt, now);
  const project: ChatProject = {
    id,
    name: input.name.trim().slice(0, 60),
    description: typeof input.description === "string" ? input.description.slice(0, 500) : "",
    instructions: typeof input.instructions === "string" ? input.instructions.slice(0, 30000) : "",
    defaultModel: typeof input.defaultModel === "string" && input.defaultModel.trim() ? input.defaultModel.trim().slice(0, 200) : DEFAULT_MODEL,
    parameters: normalizeParameters(input.parameters),
    knowledge: Array.isArray(input.knowledge) ? input.knowledge.filter(isDocument).slice(0, 20) : [],
    createdAt,
    updatedAt: normalizeProjectTime(input.updatedAt, createdAt),
  };
  return JSON.stringify(project).length > 5_000_000 ? null : project;
}

function normalizeSharedProjects(value: unknown) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const projects: ChatProject[] = [];
  const ids = new Set<string>();
  for (const item of values.slice(0, 100)) {
    const project = normalizeSharedProject(item);
    if (!project || ids.has(project.id)) continue;
    ids.add(project.id);
    projects.push(project);
  }
  return projects;
}

export async function getSharedProjects() {
  if (!hasPersistentKv()) return memoryProjects;
  let payload = await kvCommand<string | null>(["GET", SHARED_PROJECTS_KEY]);
  if (!payload) {
    payload = await kvCommand<string | null>(["GET", LEGACY_SHARED_PROJECT_KEY]);
    if (payload) {
      let migrated: ChatProject[] = [];
      try {
        migrated = normalizeSharedProjects(JSON.parse(payload));
      } catch {
        migrated = [];
      }
      if (migrated.length) await kvCommand(["SET", SHARED_PROJECTS_KEY, JSON.stringify(migrated)]);
      memoryProjects = migrated;
      return migrated;
    }
  }
  if (!payload) return [];
  try {
    const projects = normalizeSharedProjects(JSON.parse(payload));
    memoryProjects = projects;
    return projects;
  } catch {
    return [];
  }
}

export async function getSharedProject(id: string = SHARED_PROJECT_ID) {
  return (await getSharedProjects()).find((project) => project.id === id) ?? null;
}

export async function saveSharedProject(value: unknown) {
  const project = normalizeSharedProject(value);
  if (!project) throw new Error("统一项目内容无效或过大");
  const current = await getSharedProjects();
  const projects = [project, ...current.filter((item) => item.id !== project.id)];
  if (JSON.stringify(projects).length > 5_000_000) throw new Error("统一项目总内容过大");
  if (!hasPersistentKv()) {
    if (isProductionRuntime()) throw new Error("线上尚未配置 Vercel KV，无法保存统一 Project");
    memoryProjects = projects;
    return project;
  }
  await kvCommand(["SET", SHARED_PROJECTS_KEY, JSON.stringify(projects)]);
  memoryProjects = projects;
  return project;
}

export async function deleteSharedProject(id?: string) {
  const projects = id ? (await getSharedProjects()).filter((project) => project.id !== id) : [];
  memoryProjects = projects;
  if (!hasPersistentKv()) {
    if (isProductionRuntime()) throw new Error("线上尚未配置 Vercel KV，无法删除统一 Project");
    return;
  }
  if (projects.length) await kvCommand(["SET", SHARED_PROJECTS_KEY, JSON.stringify(projects)]);
  else await kvCommand(["DEL", SHARED_PROJECTS_KEY, LEGACY_SHARED_PROJECT_KEY]);
}
