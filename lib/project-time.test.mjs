import assert from "node:assert/strict";
import test from "node:test";
import { formatProjectUpdatedAt, normalizeProjectTime } from "./project-time.ts";

test("preserves a valid stored project modification time", () => {
  assert.equal(normalizeProjectTime(1_700_000_000_000, 2_000_000_000_000), 1_700_000_000_000);
});

test("falls back safely when a legacy project has no valid time", () => {
  assert.equal(normalizeProjectTime(undefined, 2_000_000_000_000), 2_000_000_000_000);
  assert.equal(formatProjectUpdatedAt(undefined), "时间未知");
});
