"use client";

import { useRef, useState } from "react";
import { FileText, FolderKanban, LoaderCircle, Paperclip, Trash2, X } from "lucide-react";
import { ModelSelector } from "@/components/models/ModelSelector";
import { Button } from "@/components/ui/Button";
import { validateDocument } from "@/lib/attachment-utils";
import { createId, formatBytes } from "@/lib/utils";
import type { ParseResponse } from "@/types/api";
import type { ChatParameters, ChatProject, DocumentAttachment } from "@/types/chat";
import type { ModelInfo } from "@/types/model";
import { useToast } from "@/contexts/ToastContext";

type ProjectDraft = {
  name: string;
  description: string;
  instructions: string;
  defaultModel: string;
  parameters: ChatParameters;
};

export function ProjectDialog({
  project,
  defaultModel,
  defaultParameters,
  models,
  modelsLoading,
  onClose,
  onSave,
  onDelete,
  onAddKnowledge,
  onRemoveKnowledge,
}: {
  project: ChatProject | null;
  defaultModel: string;
  defaultParameters: ChatParameters;
  models: ModelInfo[];
  modelsLoading: boolean;
  onClose: () => void;
  onSave: (draft: ProjectDraft) => void;
  onDelete?: () => void;
  onAddKnowledge?: (files: DocumentAttachment[]) => void;
  onRemoveKnowledge?: (fileId: string) => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [instructions, setInstructions] = useState(project?.instructions ?? "");
  const [model, setModel] = useState(project?.defaultModel ?? defaultModel);
  const [parameters, setParameters] = useState(project?.parameters ?? defaultParameters);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  const uploadKnowledge = async (files: FileList) => {
    if (!project || !onAddKnowledge) return;
    const selected = Array.from(files);
    if (!selected.length) return;
    if (selected.length > 5) {
      notify("每次最多上传 5 个知识文件", "error");
      return;
    }
    if (project.knowledge.length + selected.length > 20) {
      notify("每个项目最多保存 20 个知识文件", "error");
      return;
    }
    try {
      selected.forEach(validateDocument);
      setParsing(true);
      const form = new FormData();
      form.set("model", model);
      selected.forEach((file) => form.append("files", file));
      const response = await fetch("/api/parse", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as (ParseResponse & { error?: string }) | null;
      if (!response.ok) throw new Error(body?.error || "知识文件解析失败");
      onAddKnowledge(
        (body?.files ?? []).map((file) => ({
          ...file,
          id: createId("knowledge"),
        })),
      );
      if (body?.truncated) notify(`知识内容超过 ${body.limit.toLocaleString()} 字符，已自动截断`);
      else notify("知识文件已加入项目", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "知识文件解析失败", "error");
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const knowledgeCharacters = project?.knowledge.reduce((sum, file) => sum + file.content.length, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={project ? "项目设置" : "新建项目"}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-panel shadow-soft"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">{project ? "项目设置" : "新建项目"}</h2>
              <p className="text-xs text-muted">项目中的对话会共享指令和知识库</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="关闭项目设置">
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
          <label className="block text-sm text-ink">
            <span className="mb-2 block font-medium">项目名称</span>
            <input
              autoFocus
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-canvas px-3 outline-none focus:border-accent"
              placeholder="例如：产品调研"
            />
          </label>
          <label className="block text-sm text-ink">
            <span className="mb-2 block font-medium">项目描述</span>
            <input
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-canvas px-3 outline-none focus:border-accent"
              placeholder="这个项目主要用来做什么？"
            />
          </label>
          <label className="block text-sm text-ink">
            <span className="mb-2 block font-medium">项目指令</span>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              className="min-h-32 w-full resize-y rounded-xl border border-line bg-canvas p-3 outline-none focus:border-accent"
              placeholder="例如：回答时使用中文，优先参考知识库，结论后列出依据……"
            />
            <span className="mt-1 block text-xs text-muted">自动应用于此项目内的每一次对话。</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-ink">
              <span className="mb-2 block font-medium">默认模型</span>
              <ModelSelector model={model} models={models} loading={modelsLoading} onChange={setModel} />
            </label>
            <label className="block text-sm text-ink">
              <span className="mb-2 flex justify-between font-medium">
                <span>Temperature</span><span className="text-muted">{parameters.temperature.toFixed(1)}</span>
              </span>
              <input
                className="mt-2 w-full accent-[rgb(var(--accent))]"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={parameters.temperature}
                onChange={(event) => setParameters((current) => ({ ...current, temperature: Number(event.target.value) }))}
              />
            </label>
          </div>

          {project ? (
            <div className="rounded-2xl border border-line bg-canvas/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">项目知识库</h3>
                  <p className="text-xs text-muted">
                    {project.knowledge.length} 个文件 · {knowledgeCharacters.toLocaleString()} 字符
                  </p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".txt,.md,.pdf,.docx,.csv,.json,.js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.rb,.php,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.sh,.sql,.yaml,.yml,.xml,.html,.css"
                  onChange={(event) => event.target.files && void uploadKnowledge(event.target.files)}
                />
                <Button size="sm" onClick={() => inputRef.current?.click()} disabled={parsing}>
                  {parsing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  {parsing ? "解析中" : "添加文件"}
                </Button>
              </div>
              <div className="space-y-2">
                {project.knowledge.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink">{file.name}</p>
                      <p className="text-[11px] text-muted">
                        {formatBytes(file.size)} · {file.content.length.toLocaleString()} 字符{file.truncated ? " · 已截断" : ""}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="danger"
                      onClick={() => onRemoveKnowledge?.(file.id)}
                      aria-label={`删除 ${file.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {!project.knowledge.length ? (
                  <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-muted">
                    暂无知识文件。上传后，项目中的所有对话都会参考这些内容。
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-accent/5 px-4 py-3 text-xs text-muted">
              创建项目后即可上传知识库文件。
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-line px-5 py-4 sm:px-6">
          <div>
            {project && onDelete ? (
              <Button variant="danger" onClick={onDelete}><Trash2 className="h-4 w-4" />删除项目</Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() =>
                onSave({
                  name,
                  description,
                  instructions,
                  defaultModel: model,
                  parameters: { ...parameters, systemPrompt: parameters.systemPrompt || "" },
                })
              }
            >
              保存
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
