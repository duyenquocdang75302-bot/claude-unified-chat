import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { NextRequest } from "next/server";
import { MAX_DOCUMENTS, MAX_FILE_BYTES, TEXT_FILE_EXTENSIONS } from "@/lib/constants";
import { documentCharacterLimit } from "@/lib/model-utils";
import { fileExtension } from "@/lib/utils";
import type { ParsedFileResult } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", ...TEXT_FILE_EXTENSIONS]);

async function extractText(file: File, buffer: Buffer) {
  const extension = fileExtension(file.name);
  if (extension === "pdf") return (await pdfParse(buffer)).text;
  if (extension === "docx") return (await mammoth.extractRawText({ buffer })).value;
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer).replace(/\0/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const model = String(formData.get("model") || "");
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) return Response.json({ error: "请选择要解析的文件" }, { status: 400 });
    if (files.length > MAX_DOCUMENTS) return Response.json({ error: "一次最多解析 5 个文件" }, { status: 400 });

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) return Response.json({ error: `${file.name} 超过 20MB 限制` }, { status: 413 });
      if (!ALLOWED_EXTENSIONS.has(fileExtension(file.name))) {
        return Response.json({ error: `不支持文件类型：${file.name}` }, { status: 415 });
      }
    }

    const limit = documentCharacterLimit(model);
    let remaining = limit;
    let anyTruncated = false;
    const results: ParsedFileResult[] = [];

    for (const file of files) {
      const text = (await extractText(file, Buffer.from(await file.arrayBuffer()))).trim();
      const truncated = text.length > remaining;
      const content = remaining > 0 ? text.slice(0, remaining) : "";
      remaining = Math.max(0, remaining - content.length);
      anyTruncated ||= truncated;
      results.push({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        content: truncated ? `${content}\n\n[内容超出当前模型限制，已截断]` : content,
        truncated,
      });
    }
    return Response.json({ files: results, limit, truncated: anyTruncated });
  } catch (error) {
    console.error("Parse file error", error);
    return Response.json({ error: "文件解析失败，请确认文件未损坏" }, { status: 500 });
  }
}
