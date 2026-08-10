import { CLAUDE_DOCUMENT_LIMIT, DEFAULT_MODELS, OTHER_DOCUMENT_LIMIT } from "@/lib/constants";
import type { ModelInfo } from "@/types/model";

export type ModelGroupId =
  | "claude"
  | "openai"
  | "deepseek"
  | "gemini"
  | "qwen"
  | "grok"
  | "llama"
  | "mistral"
  | "other";

export type ModelGroup = {
  id: ModelGroupId;
  label: string;
  models: ModelInfo[];
};

const MODEL_GROUPS: Array<Pick<ModelGroup, "id" | "label">> = [
  { id: "claude", label: "Claude 系列" },
  { id: "openai", label: "OpenAI / GPT 系列" },
  { id: "deepseek", label: "DeepSeek 系列" },
  { id: "gemini", label: "Gemini 系列" },
  { id: "qwen", label: "Qwen 系列" },
  { id: "grok", label: "Grok 系列" },
  { id: "llama", label: "Llama 系列" },
  { id: "mistral", label: "Mistral 系列" },
  { id: "other", label: "其他模型" },
];

export function isClaudeModel(model: string) {
  return model.toLowerCase().includes("claude");
}

function isOpenAIModel(model: string, ownedBy = "") {
  const value = `${model} ${ownedBy}`.toLowerCase();
  return value.includes("openai") || /(?:^|[-/:])(gpt|chatgpt|o1|o3|o4|codex)(?:[-/:]|$)/.test(model.toLowerCase());
}

export function modelGroup(model: ModelInfo | string): ModelGroupId {
  const id = typeof model === "string" ? model : model.id;
  const ownedBy = typeof model === "string" ? "" : model.ownedBy ?? "";
  const value = `${id} ${ownedBy}`.toLowerCase();
  if (value.includes("claude") || value.includes("anthropic")) return "claude";
  if (isOpenAIModel(id, ownedBy)) return "openai";
  if (value.includes("deepseek")) return "deepseek";
  if (value.includes("gemini") || value.includes("google")) return "gemini";
  if (value.includes("qwen") || value.includes("aliyun")) return "qwen";
  if (value.includes("grok") || value.includes("xai")) return "grok";
  if (value.includes("llama") || value.includes("meta")) return "llama";
  if (value.includes("mistral") || value.includes("mixtral")) return "mistral";
  return "other";
}

export function documentCharacterLimit(model: string) {
  return isClaudeModel(model) ? CLAUDE_DOCUMENT_LIMIT : OTHER_DOCUMENT_LIMIT;
}

export function sortModels(models: ModelInfo[]) {
  return [...models].sort((a, b) => {
    const aGroup = MODEL_GROUPS.findIndex((group) => group.id === modelGroup(a));
    const bGroup = MODEL_GROUPS.findIndex((group) => group.id === modelGroup(b));
    if (aGroup !== bGroup) return aGroup - bGroup;
    return a.id.localeCompare(b.id);
  });
}

export function groupModels(models: ModelInfo[]): ModelGroup[] {
  const buckets = new Map<ModelGroupId, ModelInfo[]>();
  for (const model of sortModels(models)) {
    const group = modelGroup(model);
    const bucket = buckets.get(group) ?? [];
    bucket.push(model);
    buckets.set(group, bucket);
  }
  return MODEL_GROUPS
    .map((group) => ({ ...group, models: buckets.get(group.id) ?? [] }))
    .filter((group) => group.models.length > 0);
}

export function fallbackModels(): ModelInfo[] {
  return DEFAULT_MODELS.map((id) => ({ id, ownedBy: id.startsWith("claude") ? "anthropic" : undefined }));
}
