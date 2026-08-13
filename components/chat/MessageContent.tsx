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
import { splitShotSections } from "@/lib/shot-sections";
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

const ShotSection = memo(function ShotSection({ heading, content, copyContent }: { heading: string; content: string; copyContent: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await copyText(copyContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="group/shot relative my-5 border-t border-line pt-5 first:mt-2">
      <div className="mb-4 flex min-h-8 items-center justify-between gap-3">
        <h3 className="m-0 text-base font-semibold text-ink">{heading}</h3>
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
      <MarkdownChunk content={content} />
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
          ? <>{shotSections.prefix ? <MarkdownChunk content={shotSections.prefix} /> : null}{shotSections.sections.map((shot, index) => <ShotSection key={`${index}-${shot.heading}`} heading={shot.heading} content={shot.content} copyContent={shot.copyContent} />)}</>
          : chunks.map((chunk, index) => <MarkdownChunk key={`${index}-${chunk.length}`} content={chunk} />)}
        {streaming ? <span className="stream-cursor" /> : null}
      </div>
      {preview ? <ImageLightbox src={preview.dataUrl} alt={preview.name} onClose={() => setPreview(null)} /> : null}
    </>
  );
});
