"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", listener);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-10 rounded-full bg-black/55 p-2.5 text-white shadow-lg transition hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white sm:right-6 sm:top-6"
        onClick={onClose}
        aria-label="关闭图片预览"
        title="关闭（Esc）"
      >
        <X className="h-6 w-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block h-auto w-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] rounded-lg object-contain shadow-2xl sm:max-h-[calc(100dvh-4rem)] sm:max-w-[calc(100vw-4rem)]"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
