export interface ModelInfo {
  id: string;
  ownedBy?: string;
}

export interface ModelsResponse {
  data: ModelInfo[];
  source: "upstream" | "fallback";
  warning?: string;
}
