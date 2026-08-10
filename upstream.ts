export function getBaseUrl() {
  return (process.env.OPENAI_BASE_URL || "https://apikey.fun/v1").replace(/\/+$/, "");
}

export function upstreamHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}
