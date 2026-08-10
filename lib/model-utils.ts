import { CLAUDE_DOCUMENT_LIMIT, DEFAULT_MODELS, OTHER_DOCUMENT_LIMIT } from "@/lib/constants";
import type { ModelInfo } from "@/types/model";

export function isClaudeModel(model: string) {
  return model.toLowerCase().includes("claude");
}

export function documentCharacterLimit(model: string) {
  return isClaudeModel(model) ? CLAUDE_DOCUMENT_LIMIT : OTHER_DOCUMENT_LIMIT;
}

export function sortModels(models: ModelInfo[]) {
  return [...models].sort((a, b) => {
    const aClaude = isClaudeModel(a.id) ? 0 : 1;
    const bClaude = isClaudeModel(b.id) ? 0 : 1;
    if (aClaude !== bClaude) return aClaude - bClaude;
    return a.id.localeCompare(b.id);
  });
}

export function fallbackModels(): ModelInfo[] {
  return DEFAULT_MODELS.map((id) => ({ id, ownedBy: id.startsWith("claude") ? "anthropic" : undefined }));
}
