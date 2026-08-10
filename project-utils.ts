import { documentCharacterLimit } from "@/lib/model-utils";
import type { ChatProject } from "@/types/chat";

export function projectContext(project: ChatProject | null | undefined, model: string) {
  if (!project) return "";
  const limit = documentCharacterLimit(model);
  const sections: string[] = [];

  if (project.instructions.trim()) {
    sections.push(`[项目指令]\n${project.instructions.trim()}\n[项目指令结束]`);
  }

  let remaining = limit;
  const knowledgeBlocks: string[] = [];
  for (const file of project.knowledge) {
    if (remaining <= 0) break;
    const content = file.content.slice(0, remaining);
    remaining -= content.length;
    knowledgeBlocks.push(`[项目知识文件: ${file.name}]\n${content}\n[项目知识文件结束]`);
  }

  if (knowledgeBlocks.length) {
    sections.push(`[项目知识库]\n${knowledgeBlocks.join("\n\n")}\n[项目知识库结束]`);
  }
  return sections.join("\n\n");
}

export function mergeProjectSystemPrompt(project: ChatProject | null | undefined, model: string, conversationPrompt: string) {
  return [projectContext(project, model), conversationPrompt.trim()].filter(Boolean).join("\n\n");
}
