import { MAX_FILE_BYTES, TEXT_FILE_EXTENSIONS } from "@/lib/constants";
import { fileExtension } from "@/lib/utils";

const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx", ...TEXT_FILE_EXTENSIONS]);

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function isSupportedDocument(file: File) {
  return DOCUMENT_EXTENSIONS.has(fileExtension(file.name));
}

export function validateDocument(file: File) {
  if (!isSupportedDocument(file)) throw new Error(`不支持文件类型：${file.name}`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} 超过 20MB 限制`);
}
