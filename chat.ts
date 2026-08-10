export type MessageRole = "user" | "assistant";

export interface ImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface DocumentAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  content: string;
  truncated: boolean;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  images?: ImageAttachment[];
  documents?: DocumentAttachment[];
  createdAt: number;
  status?: "streaming" | "complete" | "error";
  error?: string;
}

export interface ChatParameters {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface Conversation {
  id: string;
  title: string;
  titleMode?: "auto" | "manual";
  titleGenerated?: boolean;
  projectId?: string | null;
  model: string;
  parameters: ChatParameters;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatProject {
  id: string;
  name: string;
  description: string;
  instructions: string;
  defaultModel: string;
  parameters: ChatParameters;
  knowledge: DocumentAttachment[];
  createdAt: number;
  updatedAt: number;
}
