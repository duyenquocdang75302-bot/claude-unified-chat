"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { ImageLightbox } from "@/components/attachments/ImageLightbox";
import type { ImageAttachment } from "@/types/chat";

function splitMarkdown(content: string, size = 9000) {
  if (content.length <= size) return [content];
  const paragraphs = content.split("\n\n");
  const chunks: string[] = [];
  let current = "";
  let inFence = false;
  for (const paragraph of paragraphs) {
    const fenceCount = (paragraph.match(/```/g) ?? []).length;
    if (current && current.length + paragraph.length > size && !inFence) { chunks.push(current); current = ""; }
    current += `${current ? "\n\n" : ""}${paragraph}`;
    if (fenceCount % 2) inFence = !inFence;
  }
  if (current) chunks.push(current);
  return chunks;
}

const MarkdownChunk = memo(function MarkdownChunk({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
      components={{
        pre: ({ children }) => <>{children}</>,
        code: ({ className, children, ...props }) => className ? <CodeBlock className={className}>{children}</CodeBlock> : <code className="rounded bg-muted/10 px-1.5 py-0.5 text-[0.9em]" {...props}>{children}</code>,
        a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">{children}</a>,
      }}
    >{content}</ReactMarkdown>
  );
});

export const MessageContent = memo(function MessageContent({ content, images = [], streaming = false }: { content: string; images?: ImageAttachment[]; streaming?: boolean }) {
  const [preview, setPreview] = useState<ImageAttachment | null>(null);
  const chunks = streaming ? [content] : splitMarkdown(content);
  return (
    <>
      {images.length ? <div className="mb-3 flex flex-wrap gap-2">{images.map((image) => (
        <button key={image.id} onClick={() => setPreview(image)} className="overflow-hidden rounded-xl border border-line bg-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.dataUrl} alt={image.name} className="h-32 max-w-56 object-cover" />
        </button>
      ))}</div> : null}
      <div className="markdown-body">{chunks.map((chunk, index) => <MarkdownChunk key={`${index}-${chunk.length}`} content={chunk} />)}{streaming ? <span className="stream-cursor" /> : null}</div>
      {preview ? <ImageLightbox src={preview.dataUrl} alt={preview.name} onClose={() => setPreview(null)} /> : null}
    </>
  );
});
