import assert from "node:assert/strict";
import test from "node:test";
import { splitShotSections } from "./shot-sections.ts";

test("does not split inline references to another shot", () => {
  const result = splitShotSections(`SHOT 1\nFirst prompt\n\nSHOT 2\nLength same as Shot 1.\nShot 1. No bag; same styling as above.\nSurface smoothness same as Shot 1.\nLIGHTING Same as Shot 1.`);
  assert.equal(result?.sections.length, 2);
  assert.deepEqual(result?.sections.map((section) => section.heading), ["Shot 1", "Shot 2"]);
  assert.match(result?.sections[1].content ?? "", /same as Shot 1/);
});

test("rejects out-of-order heading matches", () => {
  const result = splitShotSections("SHOT 2\nPrompt\n\nSHOT 1\nReference only\n\nSHOT 1\nReference only");
  assert.equal(result, null);
});

test("splits a fenced common manifest followed by delimited shots", () => {
  const shots = Array.from({ length: 8 }, (_, index) => `Shot type & primary reference: frame ${index + 1}\nPrompt ${index + 1}`);
  const result = splitShotSections(`\`\`\`\nUPLOAD MANIFEST\nShared rules\n\n---\n\n${shots.join("\n\n---\n\n")}\n\`\`\``);
  assert.equal(result?.prefix, "UPLOAD MANIFEST\nShared rules");
  assert.equal(result?.sections.length, 8);
  assert.equal(result?.sections[7].heading, "Shot 8");
});

test("splits repeated manifest prompts", () => {
  const result = splitShotSections("UPLOAD MANIFEST\nShot type & primary reference: first\n\n---\n\nUPLOAD MANIFEST\nShot type & primary reference: second");
  assert.equal(result?.sections.length, 2);
  assert.match(result?.sections[0].copyContent ?? "", /^UPLOAD MANIFEST/);
});

test("keeps equals-wrapped shot headings with their matching prompt", () => {
  const result = splitShotSections(`=== SHOT #1: full-length · smiling with bag ===

UPLOAD MANIFEST
FIRST SHOT UNIQUE PROMPT

================================================

=== SHOT #2: full-length · neutral without bag ===

UPLOAD MANIFEST
SECOND SHOT UNIQUE PROMPT

================================================`);

  assert.equal(result?.prefix, "");
  assert.equal(result?.sections.length, 2);
  assert.equal(result?.sections[0].heading, "Shot 1 — full-length · smiling with bag");
  assert.equal(result?.sections[1].heading, "Shot 2 — full-length · neutral without bag");
  assert.match(result?.sections[0].copyContent ?? "", /FIRST SHOT UNIQUE PROMPT/);
  assert.doesNotMatch(result?.sections[0].copyContent ?? "", /SECOND SHOT UNIQUE PROMPT/);
  assert.match(result?.sections[1].copyContent ?? "", /SECOND SHOT UNIQUE PROMPT/);
  assert.doesNotMatch(result?.sections[1].copyContent ?? "", /FIRST SHOT UNIQUE PROMPT/);
  assert.doesNotMatch(result?.sections[0].content ?? "", /^=+$/m);
  assert.doesNotMatch(result?.sections[1].content ?? "", /^=+$/m);
});
