export const MARKDOWN_FILE_ACCEPT = ".md,.markdown,text/markdown,text/x-markdown";

export function isMarkdownFileName(fileName: string) {
  return /\.(?:md|markdown)$/i.test(fileName.trim());
}
