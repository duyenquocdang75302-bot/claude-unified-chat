import assert from "node:assert/strict";
import test from "node:test";
import { isMarkdownFileName, MARKDOWN_FILE_ACCEPT } from "./project-knowledge.ts";

test("accepts common Markdown file extensions", () => {
  assert.equal(isMarkdownFileName("instructions.md"), true);
  assert.equal(isMarkdownFileName("PROJECT.MD"), true);
  assert.equal(isMarkdownFileName("knowledge.markdown"), true);
});

test("rejects non-Markdown files in the dedicated importer", () => {
  assert.equal(isMarkdownFileName("notes.txt"), false);
  assert.equal(isMarkdownFileName("archive.md.zip"), false);
  assert.match(MARKDOWN_FILE_ACCEPT, /\.md/);
  assert.match(MARKDOWN_FILE_ACCEPT, /\.markdown/);
});
