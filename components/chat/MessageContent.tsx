"use client";

import { memo, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { ImageLightbox } from "@/components/attachments/ImageLightbox";
import type { ImageAttachment } from "@/types/chat";

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy failed");
}

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

function splitShotSections(content: string) {
  const lines = content.split(/\r?\n/);
  const sections: Array<{ heading: string; content: string }> = [];
  const prefix: string[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    const heading = line.match(/^\s*(?:#{1,6}\s*)?Shot\s+\d+\b[^\n]*$/i);
    if (heading) {
      if (current) sections.push({ heading: current.heading, content: current.lines.join("\n").trim() });
      current = { heading: line, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      prefix.push(line);
    }
  }
  if (current) sections.push({ heading: current.heading, content: current.lines.join("\n").trim() });
  return sections.length ? { prefix: prefix.join("\n").trim(), sections } : null;
}

const ShotSection = memo(function ShotSection({ heading, content }: { heading: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await copyText(`${heading}\n\n${content}`.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="group/shot relative border-b border-line/70 pb-5 pt-1 last:border-b-0">
      <div className="absolute right-0 top-0">
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "已复制此英文分镜" : "复制此英文分镜"}
          title={copied ? "已复制此英文分镜" : "复制此英文分镜"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-muted/10 hover:text-ink"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <div className="pr-10">
        <MarkdownChunk content={`${heading}\n\n${content}`.trim()} />
      </div>
    </section>
  );
});

export const MessageContent = memo(function MessageContent({ content, images = [], streaming = false }: { content: string; images?: ImageAttachment[]; streaming?: boolean }) {
  const [preview, setPreview] = useState<ImageAttachment | null>(null);
  const chunks = streaming ? [content] : splitMarkdown(content);
  const shotSections = useMemo(() => (streaming ? null : splitShotSections(content)), [content, streaming]);
  return (
    <>
      {images.length ? <div className="mb-3 flex flex-wrap gap-2">{images.map((image) => (
        <button key={image.id} onClick={() => setPreview(image)} className="overflow-hidden rounded-xl border border-line bg-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.dataUrl} alt={image.name} className="h-32 max-w-56 object-cover" />
        </button>
      ))}</div> : null}
      <div className="markdown-body">
        {shotSections
          ? <>{shotSections.prefix ? <MarkdownChunk content={shotSections.prefix} /> : null}{shotSections.sections.map((shot, index) => <ShotSection key={`${index}-${shot.heading}`} heading={shot.heading} content={shot.content} />)}</>
          : chunks.map((chunk, index) => <MarkdownChunk key={`${index}-${chunk.length}`} content={chunk} />)}
        {streaming ? <span className="stream-cursor" /> : null}
      </div>
      {preview ? <ImageLightbox src={preview.dataUrl} alt={preview.name} onClose={() => setPreview(null)} /> : null}
    </>
  );
});
