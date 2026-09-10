import assert from "node:assert/strict";
import test from "node:test";
import {
  isUnavailableModelChannel,
  isUnsupportedTemperature,
  modelFallbackCandidates,
  shouldTryNextFallback,
} from "./model-fallback.ts";

test("builds a unique fallback list without retrying the requested model", () => {
  assert.deepEqual(
    modelFallbackCandidates("claude-opus-4-8", "claude-sonnet-4-6, claude-opus-4-8;claude-sonnet-4-5 claude-sonnet-4-6"),
    ["claude-sonnet-4-6", "claude-sonnet-4-5"],
  );
});

test("falls back only for a confirmed unavailable account pool", () => {
  assert.equal(isUnavailableModelChannel(424, '{"message":"no account is available, please try again later"}'), true);
  assert.equal(isUnavailableModelChannel(424, "other dependency failure"), false);
  assert.equal(isUnavailableModelChannel(503, "no account is available"), false);
});

test("detects an explicitly unsupported temperature parameter", () => {
  assert.equal(isUnsupportedTemperature(400, "`temperature` is deprecated for this model."), true);
  assert.equal(isUnsupportedTemperature(400, "temperature is not supported"), true);
  assert.equal(isUnsupportedTemperature(400, "unsupported parameter: temperature"), true);
  assert.equal(isUnsupportedTemperature(422, "temperature is not supported"), false);
  assert.equal(isUnsupportedTemperature(400, "invalid image input"), false);
});

test("skips unusable fallback models but stops on billing errors", () => {
  assert.equal(shouldTryNextFallback(404, "model not found"), true);
  assert.equal(shouldTryNextFallback(503, "temporarily unavailable"), true);
  assert.equal(shouldTryNextFallback(403, "model group denied"), true);
  assert.equal(shouldTryNextFallback(403, "insufficient credit balance"), false);
});
