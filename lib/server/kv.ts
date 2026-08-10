type KvConfig = { url: string; token: string };

function config(): KvConfig | null {
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function hasPersistentKv() { return Boolean(config()); }

export async function kvCommand<T = unknown>(command: string[]): Promise<T> {
  const current = config();
  if (!current) throw new Error("尚未配置 Vercel KV，请设置 KV_REST_API_URL 和 KV_REST_API_TOKEN");
  const response = await fetch(current.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${current.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`KV 请求失败 (${response.status})`);
  const payload = (await response.json()) as { result?: T; error?: string };
  if (payload.error) throw new Error(payload.error);
  return payload.result as T;
}

export function isProductionRuntime() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}
