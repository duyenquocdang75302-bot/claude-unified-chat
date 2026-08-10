export type UsageTotals = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type UserUsage = UsageTotals & {
  userId: string;
  username: string;
};

export type ModelUsage = UsageTotals & {
  model: string;
};

export type DailyUsage = UsageTotals & {
  date: string;
};

export type RecentUsage = {
  id: string;
  userId: string;
  username: string;
  model: string;
  purpose: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
  createdAt: number;
};

export type UsageDashboard = {
  totals: UsageTotals;
  users: UserUsage[];
  models: ModelUsage[];
  daily: DailyUsage[];
  recent: RecentUsage[];
};
