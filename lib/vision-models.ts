const VISION_KEYWORDS = ["claude", "gpt-4o", "gpt-4.1", "gemini", "qwen-vl"];

export function supportsVision(modelId: string) {
  const normalized = modelId.toLowerCase();
  return VISION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
