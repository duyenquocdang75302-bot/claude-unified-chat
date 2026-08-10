import { hasPersistentKv, kvCommand } from "@/lib/server/kv";
import type { DailyUsage, ModelUsage, RecentUsage, UsageDashboard, UsageTotals, UserUsage } from "@/types/usage";

const USAGE_KEY = "claude-unified-chat:usage-events";
const MAX_EVENTS = 5000;
const memoryEvents: UsageRecord[] = [];

export type UsageRecord = {
  userId: string;
  username: string;
  model: string;
  purpose: "chat" | "title";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
};

export async function recordUsage(record: UsageRecord) {
  const normalized = {
    id: crypto.randomUUID(),
    ...record,
    promptTokens: Math.max(0, Math.round(record.promptTokens)),
    completionTokens: Math.max(0, Math.round(record.completionTokens)),
    totalTokens: Math.max(0, Math.round(record.totalTokens)),
    createdAt: Date.now(),
  };
  if (!hasPersistentKv()) {
    memoryEvents.unshift(normalized);
    memoryEvents.length = Math.min(memoryEvents.length, MAX_EVENTS);
    return;
  }
  await kvCommand(["LPUSH", USAGE_KEY, JSON.stringify(normalized)]);
  await kvCommand(["LTRIM", USAGE_KEY, "0", String(MAX_EVENTS - 1)]);
}

type StoredUsage = UsageRecord & { id: string; createdAt: number };

async function readEvents(): Promise<StoredUsage[]> {
  if (!hasPersistentKv()) return memoryEvents as StoredUsage[];
  const values = await kvCommand<string[]>(["LRANGE", USAGE_KEY, "0", String(MAX_EVENTS - 1)]);
  return (values || []).flatMap((value) => {
    try {
      const parsed = JSON.parse(value) as StoredUsage;
      return parsed && typeof parsed.createdAt === "number" ? [parsed] : [];
    } catch { return []; }
  });
}

function emptyTotals(): UsageTotals { return { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }; }
function addTotals(target: UsageTotals, event: StoredUsage) {
  target.requests += 1;
  target.promptTokens += event.promptTokens;
  target.completionTokens += event.completionTokens;
  target.totalTokens += event.totalTokens;
}

export async function getUsageDashboard(): Promise<UsageDashboard> {
  const events = await readEvents();
  const totals = emptyTotals();
  const users = new Map<string, UserUsage>();
  const models = new Map<string, ModelUsage>();
  const daily = new Map<string, DailyUsage>();
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const event of events) {
    addTotals(totals, event);
    const user = users.get(event.userId) ?? { userId: event.userId, username: event.username, ...emptyTotals() };
    addTotals(user, event); users.set(event.userId, user);
    const model = models.get(event.model) ?? { model: event.model, ...emptyTotals() };
    addTotals(model, event); models.set(event.model, model);
    if (event.createdAt >= since) {
      const date = new Date(event.createdAt).toISOString().slice(0, 10);
      const item = daily.get(date) ?? { date, ...emptyTotals() };
      addTotals(item, event); daily.set(date, item);
    }
  }
  const recent: RecentUsage[] = events.slice(0, 50).map((event) => ({
    id: event.id, userId: event.userId, username: event.username, model: event.model, purpose: event.purpose,
    promptTokens: event.promptTokens, completionTokens: event.completionTokens, totalTokens: event.totalTokens,
    estimated: event.estimated, createdAt: event.createdAt,
  }));
  return {
    totals,
    users: [...users.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    models: [...models.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    recent,
  };
}
