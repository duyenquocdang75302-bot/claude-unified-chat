import assert from "node:assert/strict";
import test from "node:test";
import { canCreateProjectScope, projectIdForScope } from "./project-scope.ts";
import { isSharedProjectId } from "./constants.ts";

test("every account can create a personal project without making it shared", () => {
  assert.equal(canCreateProjectScope("personal", false), true);
  assert.equal(canCreateProjectScope("personal", true), true);
  assert.equal(isSharedProjectId(projectIdForScope("personal", "project-1")), false);
});

test("only admins can create a shared project", () => {
  assert.equal(canCreateProjectScope("shared", false), false);
  assert.equal(canCreateProjectScope("shared", true), true);
  assert.equal(isSharedProjectId(projectIdForScope("shared", "project-1")), true);
});
