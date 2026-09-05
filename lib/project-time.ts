const projectTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function normalizeProjectTime(value: unknown, fallback: number) {
  const timestamp = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
}

export function formatProjectUpdatedAt(value: unknown) {
  const timestamp = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "时间未知";
  return projectTimeFormatter.format(new Date(timestamp));
}
