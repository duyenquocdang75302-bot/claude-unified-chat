import type { AppSettings } from "@/types/settings";

export const DEFAULT_MODELS = [
  // Keep the built-in list useful when the upstream /models endpoint is unavailable.
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-5",
  "claude-opus-5",
  "claude-haiku-4-5",
  "claude-sonnet-4-5",
  "claude-opus-4-5",
  "claude-3-7-sonnet",
  "gpt-4o",
  "deepseek-chat",
  "gemini-2.5-pro",
] as const;

export const DEFAULT_MODEL = "claude-sonnet-4-5";
export const SHARED_PROJECT_ID = "shared";
export const MAX_IMAGES = 20;
export const MAX_DOCUMENTS = 5;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const IMAGE_COMPRESS_THRESHOLD = 2 * 1024 * 1024;
export const CLAUDE_DOCUMENT_LIMIT = 150_000;
export const OTHER_DOCUMENT_LIMIT = 50_000;

export const DEFAULT_SETTINGS: AppSettings = {
  defaultModel: DEFAULT_MODEL,
  temperature: 0.7,
  maxTokens: 8192,
  systemPrompt: "",
  theme: "system",
};

export const TEXT_FILE_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "json", "yaml", "yml", "xml", "html", "css",
  "js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "rb", "php", "c", "h",
  "cpp", "hpp", "cs", "swift", "kt", "kts", "sh", "bash", "zsh", "sql", "toml",
  "ini", "conf", "log", "env", "vue", "svelte",
]);
