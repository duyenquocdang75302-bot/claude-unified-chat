"use client";

import { useCallback, useState } from "react";
import { isImageFile, validateDocument } from "@/lib/attachment-utils";
import { MAX_DOCUMENTS, MAX_IMAGES } from "@/lib/constants";
import { prepareImage } from "@/lib/image-utils";
import { createId } from "@/lib/utils";
import { supportsVision } from "@/lib/vision-models";
import type { DocumentAttachment, ImageAttachment } from "@/types/chat";
import type { ParseResponse } from "@/types/api";
import { useToast } from "@/contexts/ToastContext";

export function useAttachments(model: string) {
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);
  const [parsing, setParsing] = useState(false);
  const { notify } = useToast();

  const addFiles = useCallback(async (input: File[] | FileList) => {
    const files = Array.from(input);
    const imageFiles = files.filter(isImageFile);
    const documentFiles = files.filter((file) => !isImageFile(file));

    if (imageFiles.length) {
      if (!supportsVision(model)) {
        notify("当前模型不支持图片", "error");
      } else if (images.length + imageFiles.length > MAX_IMAGES) {
        notify("一次最多上传 20 张图片", "error");
      } else {
        try {
          const prepared = await Promise.all(imageFiles.map(prepareImage));
          setImages((current) => [...current, ...prepared]);
        } catch (error) {
          notify(error instanceof Error ? error.message : "图片处理失败", "error");
        }
      }
    }

    if (!documentFiles.length) return;
    if (documents.length + documentFiles.length > MAX_DOCUMENTS) {
      notify("一次最多上传 5 个文档", "error");
      return;
    }
    try {
      documentFiles.forEach(validateDocument);
      setParsing(true);
      const form = new FormData();
      form.set("model", model);
      documentFiles.forEach((file) => form.append("files", file));
      const response = await fetch("/api/parse", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as (ParseResponse & { error?: string }) | null;
      if (!response.ok) throw new Error(body?.error || "文件解析失败");
      setDocuments((current) => [
        ...current,
        ...(body?.files ?? []).map((file) => ({ ...file, id: createId("doc") })),
      ]);
      if (body?.truncated) notify(`文档内容超过 ${body.limit.toLocaleString()} 字符，已自动截断`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "文件解析失败", "error");
    } finally {
      setParsing(false);
    }
  }, [documents.length, images.length, model, notify]);

  return {
    images,
    documents,
    parsing,
    addFiles,
    removeImage: (id: string) => setImages((current) => current.filter((item) => item.id !== id)),
    removeDocument: (id: string) => setDocuments((current) => current.filter((item) => item.id !== id)),
    clear: () => { setImages([]); setDocuments([]); },
  };
}
