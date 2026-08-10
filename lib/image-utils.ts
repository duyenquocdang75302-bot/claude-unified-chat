import { IMAGE_COMPRESS_THRESHOLD } from "@/lib/constants";
import { createId } from "@/lib/utils";
import type { ImageAttachment } from "@/types/chat";

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法识别该图片"));
    image.src = url;
  });
}

export async function prepareImage(file: File): Promise<ImageAttachment> {
  if (!file.type.startsWith("image/")) throw new Error("仅支持图片文件");
  let dataUrl = await readAsDataUrl(file);
  let mimeType = file.type || "image/png";

  if (file.size > IMAGE_COMPRESS_THRESHOLD) {
    const image = await loadImage(dataUrl);
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器不支持图片压缩");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    mimeType = file.type === "image/png" && file.size <= 4 * 1024 * 1024 ? "image/png" : "image/jpeg";
    dataUrl = canvas.toDataURL(mimeType, 0.8);
  }

  const estimatedSize = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  return { id: createId("img"), name: file.name || "clipboard-image.png", mimeType, size: estimatedSize, dataUrl };
}
