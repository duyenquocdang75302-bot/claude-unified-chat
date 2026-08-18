import assert from "node:assert/strict";
import test from "node:test";
import { recentMessagesForUpstream, toUpstreamMessages } from "./message-utils.ts";

const message = (role, content, extra = {}) => ({
  id: `${role}-${content.length}`,
  role,
  content,
  createdAt: 1,
  status: "complete",
  ...extra,
});

test("does not resend an old image after a newer text-only user turn", () => {
  const upstream = toUpstreamMessages([
    message("user", "分析图片", {
      images: [{ id: "image-1", name: "look.jpg", mimeType: "image/jpeg", size: 10, dataUrl: "data:image/jpeg;base64,abc" }],
    }),
    message("assistant", "图片分析结果"),
    message("user", "继续整理为分镜"),
  ]);

  assert.equal(typeof upstream[0].content, "string");
  assert.match(upstream[0].content, /此前上传的图片: look.jpg/);
  assert.equal(typeof upstream[2].content, "string");
});

test("includes images when they belong to the newest user turn", () => {
  const upstream = toUpstreamMessages([
    message("user", "分析这张图", {
      images: [{ id: "image-1", name: "look.jpg", mimeType: "image/jpeg", size: 10, dataUrl: "data:image/jpeg;base64,abc" }],
    }),
  ]);

  assert.ok(Array.isArray(upstream[0].content));
  assert.equal(upstream[0].content[1].image_url.url, "data:image/jpeg;base64,abc");
});

test("keeps the newest request while dropping oversized old answers", () => {
  const selected = recentMessagesForUpstream([
    message("user", "最初要求"),
    message("assistant", "x".repeat(80_000)),
    message("user", "现在继续"),
  ], 10_000);

  assert.deepEqual(selected.map((item) => item.content), ["最初要求", "现在继续"]);
});
