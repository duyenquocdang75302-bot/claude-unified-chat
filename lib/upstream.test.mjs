import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBaseUrl } from "./server/upstream.ts";

test("keeps the new APIKEY domain unchanged", () => {
  assert.equal(normalizeBaseUrl("https://api.apikey.fan/v1/"), "https://api.apikey.fan/v1");
});

test("automatically migrates legacy APIKEY domains", () => {
  assert.equal(normalizeBaseUrl("https://apikey.fun/v1"), "https://api.apikey.fan/v1");
  assert.equal(normalizeBaseUrl("https://api.apikey.fun/v1/"), "https://api.apikey.fan/v1");
});

test("does not rewrite unrelated custom upstreams", () => {
  assert.equal(normalizeBaseUrl("https://example.com/openai/v1/"), "https://example.com/openai/v1");
});
