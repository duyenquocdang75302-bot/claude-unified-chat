"use client";

import { useMemo, useState } from "react";
import { FolderKanban, LoaderCircle, Menu, MessageSquarePlus } from "lucide-react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { ProjectOverview } from "@/components/projects/ProjectOverview";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Button } from "@/components/ui/Button";
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useModels } from "@/hooks/useModels";
import { isSharedProjectId } from "@/lib/constants";
import {
  canManageSharedProjects,
  sharedProjectManagementIsDisabled,
  type ProjectScope,
} from "@/lib/project-scope";

export function ChatApp() {
  const chat = useChat();
  const { user } = useAuth();
  const sharedManagementDisabled = sharedProjectManagementIsDisabled(
    process.env.NEXT_PUBLIC_SHARED_PROJECT_MANAGEMENT_DISABLED,
  );
  const canManageProjects = canManageSharedProjects(user?.role === "admin", sharedManagementDisabled);
  const canManageProject = (project: { id: string }) => canManageProjects || !isSharedProjectId(project.id);
  const { settings } = useSettings();
  const { models, loading } = useModels();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectDialog, setProjectDialog] = useState<"new-personal" | "new-shared" | string | null>(null);
  const defaultParameters = useMemo(
    () => ({
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      systemPrompt: settings.systemPrompt,
    }),
    [settings.temperature, settings.maxTokens, settings.systemPrompt],
  );

  if (!chat.hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas text-muted">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const conversation = chat.activeConversation;
  const creatingProjectScope: ProjectScope | null =
    projectDialog === "new-shared" ? "shared" : projectDialog === "new-personal" ? "personal" : null;
  const editingProject =
    projectDialog && !creatingProjectScope
      ? chat.projects.find((project) => project.id === projectDialog) ?? null
      : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      <Sidebar
        open={sidebarOpen}
        projects={chat.projects}
        conversations={chat.visibleConversations}
        activeId={chat.activeId}
        activeProjectId={chat.activeProjectId}
        onClose={() => setSidebarOpen(false)}
        onCreate={() => {
          chat.createConversation();
          setSidebarOpen(false);
        }}
        onCreatePersonalProject={() => setProjectDialog("new-personal")}
        onCreateSharedProject={() => setProjectDialog("new-shared")}
        onSelectProject={chat.selectProject}
        onManageProject={(project) => setProjectDialog(project.id)}
        onSelect={chat.selectConversation}
        onRename={chat.renameConversation}
        onDelete={chat.deleteConversation}
        canManageProject={canManageProject}
        canCreateSharedProject={canManageProjects}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {conversation ? (
          <>
            <AppHeader
              model={conversation.model}
              models={models}
              modelsLoading={loading}
              parameters={conversation.parameters}
              onOpenSidebar={() => setSidebarOpen(true)}
              onModelChange={(model) => chat.updateConversation(conversation.id, { model })}
              onParametersChange={(parameters) => chat.updateConversation(conversation.id, { parameters })}
            />
            <ChatPanel
              conversation={conversation}
              generating={chat.generating}
              onSend={chat.sendMessage}
              onStop={chat.stopGeneration}
              onEdit={chat.editMessage}
              onDelete={chat.deleteMessage}
              onRegenerate={(id) => void chat.regenerateMessage(id)}
              onContinue={(id) => void chat.continueGeneration(id)}
            />
          </>
        ) : chat.activeProject ? (
          <>
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-3 sm:px-5">
              <Button
                size="icon"
                variant="ghost"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="打开侧栏"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <FolderKanban className="h-5 w-5 text-accent" />
              <span className="truncate text-sm font-semibold text-ink">{chat.activeProject.name}</span>
            </header>
            <ProjectOverview
              project={chat.activeProject}
              conversationCount={chat.visibleConversations.length}
              canManage={canManageProject(chat.activeProject)}
              onNewConversation={() => chat.createConversation(chat.activeProjectId)}
              onManage={() => setProjectDialog(chat.activeProjectId)}
            />
          </>
        ) : (
          <>
            <header className="flex h-16 shrink-0 items-center border-b border-line px-3 lg:hidden">
              <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(true)} aria-label="打开侧栏">
                <Menu className="h-5 w-5" />
              </Button>
            </header>
            <main className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <MessageSquarePlus className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-semibold text-ink">开始普通对话</h1>
                <p className="mt-2 text-sm text-muted">普通对话不使用任何项目指令或项目知识库。</p>
                <Button variant="primary" className="mt-5" onClick={() => chat.createConversation(null)}>
                  新建对话
                </Button>
              </div>
            </main>
          </>
        )}
      </div>

      {projectDialog ? (
        <ProjectDialog
          key={projectDialog}
          project={editingProject}
          scope={creatingProjectScope ?? (editingProject && isSharedProjectId(editingProject.id) ? "shared" : "personal")}
          defaultModel={settings.defaultModel}
          defaultParameters={defaultParameters}
          models={models}
          modelsLoading={loading}
          readOnly={Boolean(editingProject && !canManageProject(editingProject))}
          onClose={() => setProjectDialog(null)}
          onSave={(draft) => {
            if (editingProject && !canManageProject(editingProject)) return;
            if (editingProject) chat.updateProject(editingProject.id, draft);
            else if (creatingProjectScope && !chat.createProject(draft, creatingProjectScope)) return;
            setProjectDialog(null);
          }}
          onDelete={
            editingProject && canManageProject(editingProject)
              ? () => {
                  if (
                    window.confirm(
                      `确定删除项目“${editingProject.name}”吗？项目知识库和其中的所有对话都会被删除。`,
                    )
                  ) {
                    chat.deleteProject(editingProject.id);
                    setProjectDialog(null);
                  }
                }
              : undefined
          }
          onAddKnowledge={
            editingProject && canManageProject(editingProject)
              ? (files) => chat.addProjectKnowledge(editingProject.id, files)
              : undefined
          }
          onRemoveKnowledge={
            editingProject && canManageProject(editingProject)
              ? (fileId) => chat.removeProjectKnowledge(editingProject.id, fileId)
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
