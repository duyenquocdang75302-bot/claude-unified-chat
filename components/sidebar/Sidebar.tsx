"use client";

import {
  Download,
  Eye,
  Folder,
  FolderKanban,
  FolderPlus,
  MessageSquare,
  MessagesSquare,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  ShieldCheck,
  Settings,
  Settings2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { exportConversation } from "@/lib/markdown-export";
import { isSharedProjectId } from "@/lib/constants";
import { formatProjectUpdatedAt } from "@/lib/project-time";
import type { ChatProject, Conversation } from "@/types/chat";

export function Sidebar({
  open,
  projects,
  conversations,
  activeId,
  activeProjectId,
  onClose,
  onCreate,
  onCreatePersonalProject,
  onCreateSharedProject,
  onSelectProject,
  onManageProject,
  onSelect,
  onRename,
  onDelete,
  canManageProject,
  canCreateSharedProject,
}: {
  open: boolean;
  projects: ChatProject[];
  conversations: Conversation[];
  activeId: string | null;
  activeProjectId: string | null;
  onClose: () => void;
  onCreate: () => void;
  onCreatePersonalProject: () => void;
  onCreateSharedProject: () => void;
  onSelectProject: (id: string | null) => void;
  onManageProject: (project: ChatProject) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  canManageProject: (project: ChatProject) => boolean;
  canCreateSharedProject: boolean;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const sharedProjects = projects.filter((project) => isSharedProjectId(project.id));

  const sidebar = (
    <aside className="flex h-full w-[286px] flex-col border-r border-line bg-panel">
      <div className="flex h-16 items-center gap-2 px-3">
        <Button variant="primary" className="flex-1 justify-start" onClick={onCreate}>
          <Plus className="h-4 w-4" />新建对话
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="lg:hidden"
          onClick={onClose}
          aria-label="关闭侧栏"
        >
          <PanelLeftClose className="h-5 w-5" />
        </Button>
      </div>

      <div className="border-b border-line px-2 pb-3">
        <div className="flex items-center justify-between px-2 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">项目</p>
        </div>
        <div className="mb-2 space-y-1.5 px-1">
          <Button
            size="sm"
            variant="secondary"
            className="w-full justify-start"
            onClick={onCreatePersonalProject}
          >
            <FolderPlus className="h-4 w-4 text-accent" />
            建立我的 Project
            <span className="ml-auto text-[10px] font-normal text-muted">仅自己</span>
          </Button>
          {canCreateSharedProject ? (
            <Button
              size="sm"
              variant="secondary"
              className="w-full justify-start"
              onClick={onCreateSharedProject}
            >
              <ShieldCheck className="h-4 w-4 text-accent" />
              建立统一 Project
              <span className="ml-auto text-[10px] font-normal text-muted">所有人</span>
            </Button>
          ) : null}
        </div>
        <button
          className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
            activeProjectId === null ? "bg-accent/10 text-ink" : "text-muted hover:bg-muted/10 hover:text-ink"
          }`}
          onClick={() => {
            onSelectProject(null);
            onClose();
          }}
        >
          <MessagesSquare className="h-4 w-4 shrink-0" />
          <span>普通对话</span>
        </button>
        <div>
          {!sharedProjects.length ? (
            <div className="mb-2 rounded-2xl border-2 border-dashed border-accent/35 bg-accent/5 px-3 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">统一 Project</p>
                  <p className="text-[11px] text-muted">
                    {canCreateSharedProject ? "尚未创建，可点击上方按钮建立" : "等待管理员创建"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {projects.map((project) => (
            <div
              key={project.id}
              className={`group relative mb-2 ${
                isSharedProjectId(project.id) ? "rounded-2xl border-2 border-accent/40 bg-accent/5 p-1" : ""
              }`}
            >
              <button
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 pr-10 text-left text-sm transition ${
                  project.id === activeProjectId
                    ? "bg-accent/10 text-ink"
                    : "text-muted hover:bg-muted/10 hover:text-ink"
                }`}
                onClick={() => {
                  onSelectProject(project.id);
                  onClose();
                }}
              >
                {project.id === activeProjectId ? (
                  <FolderKanban className="h-4 w-4 shrink-0 text-accent" />
                ) : (
                  <Folder className="h-4 w-4 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{project.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted/80">
                    最后修改：{formatProjectUpdatedAt(project.updatedAt)}
                  </span>
                </span>
                <span className="shrink-0 self-start rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
                  {isSharedProjectId(project.id) ? "统一" : "我的"}
                </span>
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition hover:bg-panel hover:text-ink"
                onClick={() => onManageProject(project)}
                aria-label={`${canManageProject(project) ? "设置" : "查看"}项目 ${project.name}`}
                title={canManageProject(project) ? `设置项目 ${project.name}` : `查看项目内容 ${project.name}`}
              >
                {canManageProject(project) ? (
                  <Settings2 className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="truncate px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {activeProject ? `${activeProject.name} · 对话` : "普通对话"}
        </p>
        {conversations.length ? (
          conversations.map((conversation) => (
            <div key={conversation.id} className="relative mb-1">
              <button
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 pr-10 text-left text-sm transition ${
                  conversation.id === activeId
                    ? "bg-muted/10 text-ink"
                    : "text-muted hover:bg-muted/10 hover:text-ink"
                }`}
                onClick={() => {
                  onSelect(conversation.id);
                  onClose();
                }}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">{conversation.title}</span>
              </button>
              <button
                className="absolute right-2 top-2 rounded-lg p-1.5 text-muted hover:bg-panel hover:text-ink"
                onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)}
                aria-label="会话操作"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuId === conversation.id ? (
                <div className="absolute right-2 top-10 z-30 w-36 rounded-xl border border-line bg-panel p-1 shadow-soft">
                  <button
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs text-ink hover:bg-muted/10"
                    onClick={() => {
                      const title = window.prompt("重命名会话", conversation.title);
                      if (title) onRename(conversation.id, title);
                      setMenuId(null);
                    }}
                  >
                    重命名
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-ink hover:bg-muted/10"
                    onClick={() => {
                      exportConversation(conversation);
                      setMenuId(null);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />导出 Markdown
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-500 hover:bg-red-500/10"
                    onClick={() => {
                      if (window.confirm("确定删除这个会话吗？")) onDelete(conversation.id);
                      setMenuId(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />删除
                  </button>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="px-3 py-8 text-center text-xs text-muted">
            {activeProject ? "这个项目还没有对话" : "暂无普通对话"}
          </p>
        )}
      </div>

      <div className="border-t border-line p-3">
        <Link
          href="/settings"
          className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted transition hover:bg-muted/10 hover:text-ink"
        >
          <Settings className="h-4 w-4" />设置
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full lg:block">{sidebar}</div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="关闭侧栏遮罩" />
          <div className="relative h-full">{sidebar}</div>
        </div>
      ) : null}
    </>
  );
}
