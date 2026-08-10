export interface ParsedFileResult {
  name: string;
  mimeType: string;
  size: number;
  content: string;
  truncated: boolean;
}

export interface ParseResponse {
  files: ParsedFileResult[];
  limit: number;
  truncated: boolean;
}
