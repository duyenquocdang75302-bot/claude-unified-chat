export function normalizeBaseUrl(configuredUrl: string) {
  const migratedUrl = configuredUrl.replace(
    /^https?:\/\/(?:api\.)?apikey\.fun(?=\/|$)/i,
    "https://api.apikey.fan",
  );

  return migratedUrl.replace(/\/+$/, "");
}

export function getBaseUrl() {
  return normalizeBaseUrl(process.env.OPENAI_BASE_URL || "https://api.apikey.fan/v1");
}

export function upstreamHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}
