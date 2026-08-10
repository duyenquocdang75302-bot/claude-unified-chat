import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Claude Unified Chat",
  description: "以 Claude 为主、兼容 OpenAI API 格式的统一 AI 对话工作台",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
