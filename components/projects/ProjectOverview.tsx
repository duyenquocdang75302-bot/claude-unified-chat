"use client";

import { BookOpen, FolderKanban, MessageSquarePlus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SHARED_PROJECT_ID } from "@/lib/constants";
import type { ChatProject } from "@/types/chat";

export function ProjectOverview({
  project,
  conversationCount,
  canManage,
  onNewConversation,
  onManage,
}: {
  project: ChatProject;
  conversationCount: number;
  canManage: boolean;
  onNewConversation: () => void;
  onManage: () => void;
}) {
  const characters = project.knowledge.reduce((sum, file) => sum + file.content.length, 0);
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-5">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-line bg-panel p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <FolderKanban className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                  <span className="text-accent">Project</span>
                  {project.id === SHARED_PROJECT_ID ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-white">
                      统一 Project · 管理员维护
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-muted">
                      个人 Project
                    </span>
                  )}
                </div>
                <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{project.name}</h1>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {project.description || "这个项目还没有描述。"}
                </p>
              </div>
            </div>
            {canManage ? (
              <Button variant="ghost" onClick={onManage}>
                <Settings2 className="h-4 w-4" />
                {project.id === SHARED_PROJECT_ID ? "管理员设置" : "项目设置"}
              </Button>
            ) : (
              <span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">管理员统一维护</span>
            )}
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-canvas p-4">
              <p className="text-xs text-muted">项目对话</p>
              <p className="mt-1 text-xl font-semibold text-ink">{conversationCount}</p>
            </div>
            <div className="rounded-2xl bg-canvas p-4">
              <p className="text-xs text-muted">知识文件</p>
              <p className="mt-1 text-xl font-semibold text-ink">{project.knowledge.length}</p>
            </div>
            <div className="rounded-2xl bg-canvas p-4">
              <p className="text-xs text-muted">知识字符</p>
              <p className="mt-1 text-xl font-semibold text-ink">{characters.toLocaleString()}</p>
            </div>
          </div>

          {project.instructions ? (
            <div className="mt-5 rounded-2xl border border-line bg-canvas p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                <BookOpen className="h-4 w-4 text-accent" />项目指令
              </div>
              <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted">{project.instructions}</p>
            </div>
          ) : null}

          <Button variant="primary" className="mt-6 w-full sm:w-auto" onClick={onNewConversation}>
            <MessageSquarePlus className="h-4 w-4" />在项目中开始新对话
          </Button>
        </div>
      </div>
    </main>
  );
}
