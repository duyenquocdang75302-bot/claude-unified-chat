import assert from "node:assert/strict";
import test from "node:test";
import { chatRetryDelayMs, exhaustedChatError } from "./chat-request-policy.ts";
import { friendlyUpstreamError } from "./server/api-errors.ts";

test("retries an unavailable 424 model channel three times with backoff", () => {
  assert.equal(chatRetryDelayMs(424, 0), 1_200);
  assert.equal(chatRetryDelayMs(424, 1), 2_500);
  assert.equal(chatRetryDelayMs(424, 2), 5_000);
  assert.equal(chatRetryDelayMs(424, 3), null);
  assert.match(exhaustedChatError(424), /自动重试 3 次/);
});

test("keeps other transient retries bounded and does not retry client errors", () => {
  assert.equal(chatRetryDelayMs(502, 0), 800);
  assert.equal(chatRetryDelayMs(502, 1), null);
  assert.equal(chatRetryDelayMs(524, 0), 800);
  assert.equal(chatRetryDelayMs(400, 0), null);
});

test("describes an upstream 424 account-pool failure accurately", () => {
  const detail = '{"error":{"message":"no account is available, please try again later"}}';
  assert.match(friendlyUpstreamError(424, detail), /暂无可用账号/);
});
