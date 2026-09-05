"use client";

import { useRef, useState } from "react";
import { FileDown, FileText, FolderKanban, LoaderCircle, Paperclip, Trash2, X } from "lucide-react";
import { ModelSelector } from "@/components/models/ModelSelector";
import { Button } from "@/components/ui/Button";
import { validateDocument } from "@/lib/attachment-utils";
import { createId, formatBytes } from "@/lib/utils";
import type { ParseResponse } from "@/types/api";
import type { ChatParameters, ChatProject, DocumentAttachment } from "@/types/chat";
import type { ModelInfo } from "@/types/model";
import { useToast } from "@/contexts/ToastContext";
import type { ProjectScope } from "@/lib/project-scope";
import { isMarkdownFileName, MARKDOWN_FILE_ACCEPT } from "@/lib/project-knowledge";

type ProjectDraft = {
  name: string;
  description: string;
  instructions: string;
  defaultModel: string;
  parameters: ChatParameters;
};

export function ProjectDialog({
  project,
  scope,
  defaultModel,
  defaultParameters,
  models,
  modelsLoading,
  readOnly = false,
  onClose,
  onSave,
  onDelete,
  onAddKnowledge,
  onRemoveKnowledge,
}: {
  project: ChatProject | null;
  scope: ProjectScope;
  defaultModel: string;
  defaultParameters: ChatParameters;
  models: ModelInfo[];
  modelsLoading: boolean;
  readOnly?: boolean;
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
  const [importingInstructions, setImportingInstructions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const markdownInputRef = useRef<HTMLInputElement>(null);
  const instructionsMarkdownInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();
  const projectTypeName = scope === "shared" ? "统一 Project" : "我的 Project";
  const dialogTitle = readOnly ? "查看项目内容" : project ? `${projectTypeName} 设置` : `建立${projectTypeName}`;
  const dialogDescription = readOnly
    ? "统一 Project 由管理员维护，所有账号可查看"
    : scope === "shared"
      ? "所有账号可查看，仅管理员可以维护"
      : "仅当前账号在此浏览器中可见，由自己管理";

  const importMarkdownInstructions = async (file: File) => {
    try {
      if (!isMarkdownFileName(file.name)) throw new Error("请选择 .md 或 .markdown 文件");
      validateDocument(file);
      if (instructions.trim() && !window.confirm("导入 Markdown 会覆盖当前项目指令，是否继续？")) return;
      setImportingInstructions(true);
      const content = await file.text();
      if (!content.trim()) throw new Error("Markdown 文件内容为空");
      setInstructions(content);
      notify("Markdown 已导入项目指令", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Markdown 导入失败", "error");
    } finally {
      setImportingInstructions(false);
      if (instructionsMarkdownInputRef.current) instructionsMarkdownInputRef.current.value = "";
    }
  };

  const uploadKnowledge = async (files: FileList, mode: "all" | "markdown" = "all") => {
    if (!project || !onAddKnowledge) return;
    const selected = Array.from(files);
    if (!selected.length) return;
    if (mode === "markdown" && selected.some((file) => !isMarkdownFileName(file.name))) {
      notify("请选择 .md 或 .markdown 文件", "error");
      return;
    }
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
      else notify(mode === "markdown" ? "Markdown 已导入项目" : "知识文件已加入项目", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "知识文件解析失败", "error");
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = "";
      if (markdownInputRef.current) markdownInputRef.current.value = "";
    }
  };

  const knowledgeCharacters = project?.knowledge.reduce((sum, file) => sum + file.content.length, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-panel shadow-soft"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">{dialogTitle}</h2>
              <p className="text-xs text-muted">{dialogDescription}</p>
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
              autoFocus={!readOnly}
              value={name}
              maxLength={60}
              readOnly={readOnly}
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
              readOnly={readOnly}
              onChange={(event) => setDescription(event.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-canvas px-3 outline-none focus:border-accent"
              placeholder="这个项目主要用来做什么？"
            />
          </label>
          <div className="block text-sm text-ink">
            <span className="mb-2 block font-medium">项目指令</span>
            <div className="relative">
              <textarea
                aria-label="项目指令"
                value={instructions}
                readOnly={readOnly}
                onChange={(event) => setInstructions(event.target.value)}
                className={`min-h-32 w-full resize-y rounded-xl border border-line bg-canvas p-3 outline-none focus:border-accent ${readOnly ? "" : "pt-12"}`}
                placeholder="例如：回答时使用中文，优先参考知识库，结论后列出依据……"
              />
              {!readOnly ? (
                <>
                  <input
                    ref={instructionsMarkdownInputRef}
                    type="file"
                    className="hidden"
                    accept={MARKDOWN_FILE_ACCEPT}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importMarkdownInstructions(file);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-3 top-3 bg-panel/90 shadow-sm"
                    onClick={() => instructionsMarkdownInputRef.current?.click()}
                    disabled={importingInstructions}
                  >
                    {importingInstructions ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    {importingInstructions ? "导入中" : "导入 Markdown"}
                  </Button>
                </>
              ) : null}
            </div>
            <span className="mt-1 block text-xs text-muted">自动应用于此项目内的每一次对话。</span>
          </div>

          {readOnly ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-canvas px-3 py-3">
                <p className="text-xs text-muted">默认模型</p>
                <p className="mt-1 break-all text-sm font-medium text-ink">{model}</p>
              </div>
              <div className="rounded-xl border border-line bg-canvas px-3 py-3">
                <p className="text-xs text-muted">Temperature</p>
                <p className="mt-1 text-sm font-medium text-ink">{parameters.temperature.toFixed(1)}</p>
              </div>
              <div className="rounded-xl border border-line bg-canvas px-3 py-3">
                <p className="text-xs text-muted">最大输出 Tokens</p>
                <p className="mt-1 text-sm font-medium text-ink">{parameters.maxTokens.toLocaleString()}</p>
              </div>
            </div>
          ) : (
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
          )}

          {project ? (
            <div className="rounded-2xl border border-line bg-canvas/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink">项目知识库</h3>
                  <p className="text-xs text-muted">
                    {project.knowledge.length} 个文件 · {knowledgeCharacters.toLocaleString()} 字符
                  </p>
                  {!readOnly ? <p className="mt-1 text-[11px] text-muted">支持 .md / .markdown，可一次导入多个</p> : null}
                </div>
                {readOnly ? (
                  <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">只读</span>
                ) : (
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <input
                      ref={inputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept=".txt,.md,.markdown,.pdf,.docx,.csv,.json,.js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.rb,.php,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.sh,.sql,.yaml,.yml,.xml,.html,.css"
                      onChange={(event) => event.target.files && void uploadKnowledge(event.target.files)}
                    />
                    <input
                      ref={markdownInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept={MARKDOWN_FILE_ACCEPT}
                      onChange={(event) => event.target.files && void uploadKnowledge(event.target.files, "markdown")}
                    />
                    <Button size="sm" variant="ghost" onClick={() => markdownInputRef.current?.click()} disabled={parsing}>
                      <FileDown className="h-4 w-4" />
                      导入 Markdown
                    </Button>
                    <Button size="sm" onClick={() => inputRef.current?.click()} disabled={parsing}>
                      {parsing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                      {parsing ? "解析中" : "添加文件"}
                    </Button>
                  </div>
                )}
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
                    {!readOnly ? (
                      <Button
                        size="icon"
                        variant="danger"
                        onClick={() => onRemoveKnowledge?.(file.id)}
                        aria-label={`删除 ${file.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
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
          {readOnly ? (
            <div className="ml-auto"><Button variant="primary" onClick={onClose}>关闭</Button></div>
          ) : (
            <>
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
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
