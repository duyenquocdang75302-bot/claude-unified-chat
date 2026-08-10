"use client";

import { FileText, LoaderCircle, X } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import type { DocumentAttachment, ImageAttachment } from "@/types/chat";

export function AttachmentBar({ images, documents, parsing, onRemoveImage, onRemoveDocument }: {
  images: ImageAttachment[];
  documents: DocumentAttachment[];
  parsing: boolean;
  onRemoveImage: (id: string) => void;
  onRemoveDocument: (id: string) => void;
}) {
  if (!images.length && !documents.length && !parsing) return null;
  return (
    <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto border-b border-line px-3 py-3">
      {images.map((image) => (
        <div key={image.id} className="group relative h-16 w-16 overflow-hidden rounded-xl border border-line bg-canvas">
          {/* Local data URLs are intentionally used so images remain exportable offline. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.dataUrl} alt={image.name} className="h-full w-full object-cover" />
          <button onClick={() => onRemoveImage(image.id)} className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white opacity-80 hover:opacity-100" aria-label={`删除 ${image.name}`}><X className="h-3 w-3" /></button>
        </div>
      ))}
      {documents.map((file) => (
        <div key={file.id} className="flex max-w-56 items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
          <FileText className="h-5 w-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-ink">{file.name}</p><p className="text-[11px] text-muted">{formatBytes(file.size)}{file.truncated ? " · 已截断" : ""}</p></div>
          <button onClick={() => onRemoveDocument(file.id)} className="text-muted hover:text-ink" aria-label={`删除 ${file.name}`}><X className="h-4 w-4" /></button>
        </div>
      ))}
      {parsing ? <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-muted"><LoaderCircle className="h-4 w-4 animate-spin" />正在解析文档…</div> : null}
    </div>
  );
}
