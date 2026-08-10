export const usageSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    model TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'chat',
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    estimated INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS usage_events_user_created_idx ON usage_events(user_id, created_at)",
  "CREATE INDEX IF NOT EXISTS usage_events_created_idx ON usage_events(created_at)",
] as const;

export const sharedProjectSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS shared_projects (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
] as const;
