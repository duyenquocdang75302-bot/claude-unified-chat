"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { requestChat, requestConversationTitle } from "@/lib/api-client";
import { consumeChatStream, isRecoverableChatStreamError } from "@/lib/chat-stream";
import { documentCharacterLimit } from "@/lib/model-utils";
import { mergeProjectSystemPrompt } from "@/lib/project-utils";
import {
  loadActiveConversationId,
  loadActiveProjectId,
  loadConversations,
  loadProjects,
  loadSettings,
  saveActiveConversationId,
  saveActiveProjectId,
  saveConversations,
  saveProjects,
} from "@/lib/storage";
import { createId } from "@/lib/utils";
import type {
  ChatMessage,
  ChatParameters,
  ChatProject,
  Conversation,
  DocumentAttachment,
  ImageAttachment,
} from "@/types/chat";
import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { deleteSharedProject, fetchSharedProjects, saveSharedProject } from "@/lib/project-client";
import { canCreateProjectScope, projectIdForScope, type ProjectScope } from "@/lib/project-scope";
import {
  isSharedProjectId,
  MAX_CONTINUATION_CONTEXT_CHARACTERS,
  MAX_TOTAL_IMAGE_SIZE,
  SHARED_PROJECT_ID,
  UPSTREAM_MAX_TOKENS_PER_REQUEST,
} from "@/lib/constants";

type ProjectDraft = {
  name: string;
  description: string;
  instructions: string;
  defaultModel: string;
  parameters: ChatParameters;
};

type ChatContextValue = {
  conversations: Conversation[];
  projects: ChatProject[];
  activeConversation: Conversation | null;
  activeProject: ChatProject | null;
  activeId: string | null;
  activeProjectId: string | null;
  visibleConversations: Conversation[];
  hydrated: boolean;
  generating: boolean;
  createConversation: (projectId?: string | null) => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  updateConversation: (id: string, patch: Partial<Pick<Conversation, "model" | "parameters">>) => void;
  createProject: (draft: ProjectDraft, scope: ProjectScope) => string | null;
  updateProject: (id: string, patch: Partial<Omit<ChatProject, "id" | "createdAt">>) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string | null) => void;
  addProjectKnowledge: (id: string, files: DocumentAttachment[]) => void;
  removeProjectKnowledge: (projectId: string, fileId: string) => void;
  sendMessage: (content: string, images: ImageAttachment[], documents: DocumentAttachment[]) => Promise<boolean>;
  stopGeneration: () => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  continueGeneration: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

const AUTO_TITLE_PLACEHOLDERS = new Set(["新对话", "图片对话"]);
const MAX_AUTO_CONTINUATIONS = 3;
const MAX_STREAM_RECOVERIES = 2;
const AUTO_CONTINUATION_PROMPT = [
  "继续完成上一条回复。",
  "必须从刚才中断的位置直接续写，不要重复任何已经输出的标题、段落或句子。",
  "只输出尚未完成的剩余内容，并完整完成用户最初要求。",
].join("\n");

function waitForStreamRecovery(delayMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function firstLineTitle(content: string) {
  const line = content
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean);
  if (!line) return "";
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*>]\s+/, "")
    .slice(0, 20);
}

function attachmentTitle(name?: string) {
  if (!name) return "";
  return name.replace(/\.[^.]+$/, "").trim().slice(0, 20);
}

function automaticConversationTitle(messages: ChatMessage[]) {
  const userTitle = messages
    .filter((message) => message.role === "user")
    .map((message) => firstLineTitle(message.content))
    .find(Boolean);
  if (userTitle) return userTitle;

  const assistantTitle = messages
    .filter((message) => message.role === "assistant")
    .map((message) => firstLineTitle(message.content))
    .find(Boolean);
  if (assistantTitle) return assistantTitle;

  for (const message of messages) {
    const documentTitle = attachmentTitle(message.documents?.[0]?.name);
    if (documentTitle) return documentTitle;
    const imageTitle = attachmentTitle(message.images?.[0]?.name);
    if (imageTitle) return imageTitle;
  }
  return "新对话";
}

function shouldAutoTitle(title: string) {
  return AUTO_TITLE_PLACEHOLDERS.has(title);
}

function newConversation(defaultModel: string, parameters: ChatParameters, projectId: string | null): Conversation {
  const now = Date.now();
  return {
    id: createId("chat"),
    title: "新对话",
    titleMode: "auto",
    titleGenerated: false,
    projectId,
    model: defaultModel,
    parameters: {
      temperature: parameters.temperature,
      maxTokens: parameters.maxTokens,
      systemPrompt: parameters.systemPrompt,
    },
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function trimDocuments(documents: DocumentAttachment[], model: string) {
  let remaining = documentCharacterLimit(model);
  return documents.map((document) => {
    const content = document.content.slice(0, remaining);
    const truncated = document.truncated || content.length < document.content.length;
    remaining = Math.max(0, remaining - content.length);
    return {
      ...document,
      content:
        truncated && !content.includes("[内容超出当前模型限制，已截断]")
          ? `${content}\n\n[内容超出当前模型限制，已截断]`
          : content,
      truncated,
    };
  });
}

function normalizeKnowledge(existing: DocumentAttachment[], incoming: DocumentAttachment[], model: string) {
  const limit = documentCharacterLimit(model);
  let remaining = Math.max(0, limit - existing.reduce((total, file) => total + file.content.length, 0));
  return incoming.map((file) => {
    const content = file.content.slice(0, remaining);
    const truncated = file.truncated || content.length < file.content.length;
    remaining = Math.max(0, remaining - content.length);
    return {
      ...file,
      content:
        truncated && !content.includes("[内容超出当前模型限制，已截断]")
          ? `${content}\n\n[内容超出当前模型限制，已截断]`
          : content,
      truncated,
    };
  });
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { notify } = useToast();
  const { user, ready: authReady } = useAuth();
  const isAdmin = user?.role === "admin";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const conversationsRef = useRef<Conversation[]>([]);
  const projectsRef = useRef<ChatProject[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const storageErrorShownRef = useRef(false);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    void (async () => {
      const [loadedConversations, storedProjects] = await Promise.all([loadConversations(), loadProjects()]);
      let sharedProjects: ChatProject[] = [];
      let sharedProjectError = false;
      try {
        sharedProjects = await fetchSharedProjects();
      } catch {
        sharedProjectError = true;
        // Keep the last locally cached shared projects visible when the API is temporarily unavailable.
        sharedProjects = storedProjects.filter((project) => isSharedProjectId(project.id));
      }

      const storedActiveProject = loadActiveProjectId();
      const localSeed =
        storedProjects.find((project) => project.id === storedActiveProject) ?? storedProjects[0] ?? null;
      let seededLocalProjectId: string | null = null;
      if (isAdmin && !sharedProjects.length && localSeed) {
        try {
          const sharedProject = await saveSharedProject({ ...localSeed, id: SHARED_PROJECT_ID });
          sharedProjects = [sharedProject];
          seededLocalProjectId = localSeed.id;
        } catch {
          sharedProjectError = true;
        }
      }

      if (cancelled) return;
      let storedConversations: Conversation[] = loadedConversations.map((conversation) => {
        const normalized = {
          ...conversation,
          projectId:
            seededLocalProjectId && conversation.projectId === seededLocalProjectId
              ? SHARED_PROJECT_ID
              : conversation.projectId ?? null,
        };
        const legacyAutomaticTitle = automaticConversationTitle(normalized.messages);
        const titleMode =
          normalized.titleMode ??
          (shouldAutoTitle(normalized.title) || normalized.title === legacyAutomaticTitle ? "auto" : "manual");
        return {
          ...normalized,
          parameters: {
            ...normalized.parameters,
            maxTokens: normalized.parameters.maxTokens === 8192 ? 16384 : normalized.parameters.maxTokens,
          },
          title: shouldAutoTitle(normalized.title) ? legacyAutomaticTitle : normalized.title,
          titleMode,
          titleGenerated: normalized.titleGenerated ?? false,
        };
      });
      const savedSettings = loadSettings();
      if (!storedConversations.length) {
        storedConversations = [newConversation(savedSettings.defaultModel, savedSettings, null)];
      }

      const personalProjects = storedProjects.filter(
        (project) => !isSharedProjectId(project.id) && project.id !== seededLocalProjectId,
      );
      const effectiveProjects = [...sharedProjects, ...personalProjects].map((project) => ({
        ...project,
        parameters: {
          ...project.parameters,
          maxTokens: project.parameters.maxTokens === 8192 ? 16384 : project.parameters.maxTokens,
        },
      }));
      const validProjectId = effectiveProjects.some((project) => project.id === storedActiveProject)
        ? storedActiveProject
        : effectiveProjects[0]?.id ?? null;
      const storedActiveConversation = loadActiveConversationId();
      const matchingConversations = storedConversations.filter(
        (conversation) => (conversation.projectId ?? null) === validProjectId,
      );
      const nextActiveId = matchingConversations.some((conversation) => conversation.id === storedActiveConversation)
        ? storedActiveConversation
        : matchingConversations[0]?.id ?? null;

      setProjects(effectiveProjects);
      projectsRef.current = effectiveProjects;
      setConversations(storedConversations);
      conversationsRef.current = storedConversations;
      setActiveProjectId(validProjectId);
      setActiveId(nextActiveId);
      setHydrated(true);
      if (sharedProjectError && !cancelled) notify("统一项目暂时无法同步，已显示本地缓存", "error");
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAdmin, notify]);

  useEffect(() => {
    conversationsRef.current = conversations;
    projectsRef.current = projects;
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        saveActiveConversationId(activeId);
        saveActiveProjectId(activeProjectId);
      } catch {
        if (!storageErrorShownRef.current) {
          storageErrorShownRef.current = true;
          notify("聊天记录保存失败，请检查浏览器是否允许网站存储数据", "error");
        }
      }
      void Promise.all([saveConversations(conversations), saveProjects(projects)])
        .then(() => {
          storageErrorShownRef.current = false;
        })
        .catch(() => {
          if (!storageErrorShownRef.current) {
            storageErrorShownRef.current = true;
            notify("聊天记录保存失败，请检查浏览器是否允许网站存储数据", "error");
          }
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [conversations, projects, activeId, activeProjectId, hydrated, notify]);

  const mutateConversation = useCallback((id: string, updater: (conversation: Conversation) => Conversation) => {
    setConversations((current) => current.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

  const mutateProject = useCallback((id: string, updater: (project: ChatProject) => ChatProject) => {
    setProjects((current) => {
      const next = current.map((item) => (item.id === id ? updater(item) : item));
      projectsRef.current = next;
      return next;
    });
  }, []);

  const persistSharedProject = useCallback((project: ChatProject) => {
    if (!isAdmin || !isSharedProjectId(project.id)) return;
    void saveSharedProject(project).catch(() => notify("统一项目保存失败，请重试", "error"));
  }, [isAdmin, notify]);

  const selectProject = useCallback((id: string | null) => {
    if (generating) {
      notify("请先停止当前回复，再切换项目", "error");
      return;
    }
    setActiveProjectId(id);
    const candidate = conversationsRef.current
      .filter((conversation) => (conversation.projectId ?? null) === id)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    setActiveId(candidate?.id ?? null);
  }, [generating, notify]);

  const selectConversation = useCallback((id: string) => {
    const conversation = conversationsRef.current.find((item) => item.id === id);
    if (!conversation) return;
    setActiveProjectId(conversation.projectId ?? null);
    setActiveId(id);
  }, []);

  const createConversation = useCallback((requestedProjectId?: string | null) => {
    const projectId = requestedProjectId === undefined ? activeProjectId : requestedProjectId;
    const project = projectsRef.current.find((item) => item.id === projectId);
    const conversation = project
      ? newConversation(project.defaultModel, project.parameters, project.id)
      : newConversation(settings.defaultModel, settings, null);
    setConversations((current) => [conversation, ...current]);
    setActiveProjectId(project?.id ?? null);
    setActiveId(conversation.id);
    return conversation.id;
  }, [activeProjectId, settings]);

  const createProject = useCallback((draft: ProjectDraft, scope: ProjectScope) => {
    if (!canCreateProjectScope(scope, isAdmin)) {
      notify("只有管理员可以建立统一 Project", "error");
      return null;
    }
    const now = Date.now();
    const makeSharedProject = scope === "shared";
    const baseId = createId("project");
    const project: ChatProject = {
      id: projectIdForScope(scope, baseId),
      name: draft.name.trim().slice(0, 60) || "未命名项目",
      description: draft.description.trim().slice(0, 500),
      instructions: draft.instructions.trim(),
      defaultModel: draft.defaultModel,
      parameters: { ...draft.parameters },
      knowledge: [],
      createdAt: now,
      updatedAt: now,
    };
    setProjects((current) => {
      const next = [project, ...current.filter((item) => item.id !== project.id)];
      projectsRef.current = next;
      return next;
    });
    if (makeSharedProject) persistSharedProject(project);
    setActiveProjectId(project.id);
    setActiveId(null);
    return project.id;
  }, [isAdmin, notify, persistSharedProject]);

  const deleteProject = useCallback((id: string) => {
    if (isSharedProjectId(id) && !isAdmin) {
      notify("只有管理员可以删除统一项目", "error");
      return;
    }
    if (activeProjectId === id && abortRef.current) abortRef.current.abort();
    setProjects((current) => {
      const next = current.filter((project) => project.id !== id);
      projectsRef.current = next;
      return next;
    });
    setConversations((current) => current.filter((conversation) => conversation.projectId !== id));
    if (isSharedProjectId(id)) void deleteSharedProject(id).catch(() => notify("统一项目删除失败，请重试", "error"));
    if (activeProjectId === id) {
      setActiveProjectId(null);
      const unfiled = conversationsRef.current.find((conversation) => !conversation.projectId);
      setActiveId(unfiled?.id ?? null);
    }
  }, [activeProjectId, isAdmin, notify]);

  const runGeneration = useCallback(async (conversation: Conversation, baseMessages: ChatMessage[]) => {
    const assistantId = createId("msg");
    const assistant: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      status: "streaming",
    };
    mutateConversation(conversation.id, (current) => ({
      ...current,
      messages: [...baseMessages, assistant],
      updatedAt: Date.now(),
    }));
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    let pending = "";
    let responseText = "";
    let finishReason: string | null = null;
    let flushTimer: number | null = null;

    const flush = () => {
      if (!pending) return;
      const chunk = pending;
      pending = "";
      mutateConversation(conversation.id, (current) => ({
        ...current,
        messages: current.messages.map((message) =>
          message.id === assistantId ? { ...message, content: message.content + chunk } : message,
        ),
        updatedAt: Date.now(),
      }));
    };

    try {
      const project = projectsRef.current.find((item) => item.id === conversation.projectId);
      const requestConversation: Conversation = {
        ...conversation,
        parameters: {
          ...conversation.parameters,
          systemPrompt:
            isSharedProjectId(project?.id)
              ? conversation.parameters.systemPrompt
              : mergeProjectSystemPrompt(project, conversation.model, conversation.parameters.systemPrompt),
        },
      };
      let requestMessages = baseMessages;
      let autoContinuationCount = 0;
      let streamRecoveryCount = 0;
      const allowedAutoContinuations = Math.min(
        MAX_AUTO_CONTINUATIONS,
        Math.max(0, Math.ceil(conversation.parameters.maxTokens / UPSTREAM_MAX_TOKENS_PER_REQUEST) - 1),
      );
      const continuationMessages = () => {
        const completedPart: ChatMessage = {
          ...assistant,
          // Only the tail is needed for exact continuation. Sending the entire
          // accumulated answer makes every later chunk progressively slower.
          content: responseText.slice(-MAX_CONTINUATION_CONTEXT_CHARACTERS),
          status: "complete",
          finishReason: "length",
        };
        const continuationInstruction: ChatMessage = {
          id: createId("internal"),
          role: "user",
          content: AUTO_CONTINUATION_PROMPT,
          createdAt: Date.now(),
          status: "complete",
        };
        return [...baseMessages, completedPart, continuationInstruction];
      };
      do {
        finishReason = null;
        const response = await requestChat(requestConversation, requestMessages, controller.signal);
        const responseLengthBeforeRequest = responseText.length;
        try {
          await consumeChatStream(response, {
            onToken(token) {
              responseText += token;
              pending += token;
              if (flushTimer === null) {
                flushTimer = window.setTimeout(() => {
                  flushTimer = null;
                  flush();
                }, 45);
              }
            },
            onFinish(reason) {
              finishReason = reason;
            },
          });
          streamRecoveryCount = 0;
        } catch (error) {
          const recoverable = isRecoverableChatStreamError(error) && !controller.signal.aborted;
          if (recoverable && streamRecoveryCount < MAX_STREAM_RECOVERIES) {
            if (flushTimer !== null) {
              window.clearTimeout(flushTimer);
              flushTimer = null;
            }
            flush();
            streamRecoveryCount += 1;
            if (responseText) requestMessages = continuationMessages();
            await waitForStreamRecovery(700 * streamRecoveryCount, controller.signal);
            continue;
          }
          if (recoverable && responseText) {
            finishReason = "interrupted";
            break;
          }
          throw error;
        }

        const canAutoContinue =
          finishReason === "length" &&
          !controller.signal.aborted &&
          responseText.length > responseLengthBeforeRequest &&
          autoContinuationCount < allowedAutoContinuations;
        if (!canAutoContinue) break;

        if (flushTimer !== null) {
          window.clearTimeout(flushTimer);
          flushTimer = null;
        }
        flush();
        autoContinuationCount += 1;
        // These two messages are request-only context. The UI keeps rendering one continuous AI reply.
        requestMessages = continuationMessages();
      } while (true);
      if (flushTimer !== null) window.clearTimeout(flushTimer);
      flush();
      const completedMessages: ChatMessage[] = [
        ...baseMessages,
        { ...assistant, content: responseText, status: "complete", finishReason },
      ];
      mutateConversation(conversation.id, (current) => {
        const messages: ChatMessage[] = current.messages.map((message) =>
          message.id === assistantId ? { ...message, status: "complete", finishReason } : message,
        );
        return {
          ...current,
          title:
            current.titleMode !== "manual" && shouldAutoTitle(current.title)
              ? automaticConversationTitle(messages)
              : current.title,
          messages,
        };
      });
      if (conversation.titleMode !== "manual" && !conversation.titleGenerated) {
        void requestConversationTitle(conversation.model, completedMessages)
          .then((title) => {
            if (!title) return;
            mutateConversation(conversation.id, (current) =>
              current.titleMode === "manual"
                ? current
                : {
                    ...current,
                    title,
                    titleMode: "auto",
                    titleGenerated: true,
                    updatedAt: Date.now(),
                  },
            );
          })
          .catch(() => {
            // 标题生成失败时保留当前标题，不影响对话。
          });
      }
    } catch (error) {
      if (flushTimer !== null) window.clearTimeout(flushTimer);
      flush();
      const stopped = controller.signal.aborted;
      const message = error instanceof Error ? error.message : "生成失败，请重试";
      mutateConversation(conversation.id, (current) => ({
        ...current,
        messages: current.messages.map((item) =>
          item.id === assistantId
            ? { ...item, status: stopped ? "complete" : "error", error: stopped ? undefined : message }
            : item,
        ),
      }));
      if (!stopped) notify(message, "error");
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  }, [mutateConversation, notify]);

  const sendMessage = useCallback(async (
    content: string,
    images: ImageAttachment[],
    documents: DocumentAttachment[],
  ) => {
    const conversation = conversationsRef.current.find((item) => item.id === activeId);
    if (!conversation || generating || (!content.trim() && !images.length && !documents.length)) {
      return false;
    }

    // 检查图片总体积
    const totalImageSize = images.reduce((sum, img) => sum + img.size, 0);
    if (totalImageSize > MAX_TOTAL_IMAGE_SIZE) {
      notify(`图片总大小 ${(totalImageSize / 1024 / 1024).toFixed(1)}MB 超过 ${MAX_TOTAL_IMAGE_SIZE / 1024 / 1024}MB 限制，请减少图片数量`, "error");
      return false;
    }

    const userMessage: ChatMessage = {
      id: createId("msg"),
      role: "user",
      content: content.trim(),
      images,
      documents: trimDocuments(documents, conversation.model),
      createdAt: Date.now(),
      status: "complete",
    };
    const messages = [...conversation.messages, userMessage];
    const titleSource = firstLineTitle(content);
    const updated = {
      ...conversation,
      title: conversation.messages.length ? conversation.title : titleSource || "新对话",
      titleMode: conversation.messages.length ? conversation.titleMode : "auto" as const,
      titleGenerated: conversation.messages.length ? conversation.titleGenerated : false,
      messages,
      updatedAt: Date.now(),
    };
    mutateConversation(conversation.id, () => updated);
    await runGeneration(updated, messages);
    return true;
  }, [activeId, generating, mutateConversation, runGeneration, notify]);

  const regenerateMessage = useCallback(async (messageId: string) => {
    if (generating) return;
    const conversation = conversationsRef.current.find((item) => item.id === activeId);
    if (!conversation) return;
    const index = conversation.messages.findIndex(
      (message) => message.id === messageId && message.role === "assistant",
    );
    if (index < 0) return;
    const baseMessages = conversation.messages.slice(0, index);
    mutateConversation(conversation.id, (current) => ({ ...current, messages: baseMessages }));
    await runGeneration({ ...conversation, messages: baseMessages }, baseMessages);
  }, [activeId, generating, mutateConversation, runGeneration]);

  const continueGeneration = useCallback(async (messageId: string) => {
    if (generating) return;
    const conversation = conversationsRef.current.find((item) => item.id === activeId);
    if (!conversation) return;
    const index = conversation.messages.findIndex(
      (message) =>
        message.id === messageId &&
        message.role === "assistant" &&
        (message.finishReason === "length" || message.finishReason === "interrupted"),
    );
    if (index < 0) return;
    const continuation: ChatMessage = {
      id: createId("msg"),
      role: "user",
      content: "请从上次中断处继续输出，不要重复已经输出的内容。",
      createdAt: Date.now(),
      status: "complete",
    };
    const baseMessages = [...conversation.messages.slice(0, index + 1), continuation];
    mutateConversation(conversation.id, (current) => ({ ...current, messages: baseMessages, updatedAt: Date.now() }));
    await runGeneration({ ...conversation, messages: baseMessages }, baseMessages);
  }, [activeId, generating, mutateConversation, runGeneration]);

  const deleteConversation = useCallback((id: string) => {
    if (abortRef.current && id === activeId) abortRef.current.abort();
    setConversations((current) => {
      const remaining = current.filter((item) => item.id !== id);
      if (id === activeId) {
        const next = remaining.find((item) => (item.projectId ?? null) === activeProjectId);
        setActiveId(next?.id ?? null);
      }
      return remaining;
    });
  }, [activeId, activeProjectId]);

  const visibleConversations = useMemo(
    () => conversations.filter((conversation) => (conversation.projectId ?? null) === activeProjectId),
    [conversations, activeProjectId],
  );
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  const updateProject = useCallback((id: string, patch: Partial<Omit<ChatProject, "id" | "createdAt">>) => {
    if (isSharedProjectId(id) && !isAdmin) {
      notify("只有管理员可以修改统一项目", "error");
      return;
    }
    const current = projectsRef.current.find((project) => project.id === id);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: Date.now() };
    setProjects((currentProjects) => {
      const nextProjects = currentProjects.map((project) => (project.id === id ? next : project));
      projectsRef.current = nextProjects;
      return nextProjects;
    });
    persistSharedProject(next);
  }, [isAdmin, notify, persistSharedProject]);

  const addProjectKnowledge = useCallback((id: string, files: DocumentAttachment[]) => {
    if (isSharedProjectId(id) && !isAdmin) {
      notify("只有管理员可以修改统一项目", "error");
      return;
    }
    const current = projectsRef.current.find((project) => project.id === id);
    if (!current) return;
    const next = {
      ...current,
      knowledge: [...current.knowledge, ...normalizeKnowledge(current.knowledge, files, current.defaultModel)],
      updatedAt: Date.now(),
    };
    setProjects((currentProjects) => {
      const nextProjects = currentProjects.map((project) => (project.id === id ? next : project));
      projectsRef.current = nextProjects;
      return nextProjects;
    });
    persistSharedProject(next);
  }, [isAdmin, notify, persistSharedProject]);

  const removeProjectKnowledge = useCallback((projectId: string, fileId: string) => {
    if (isSharedProjectId(projectId) && !isAdmin) {
      notify("只有管理员可以修改统一项目", "error");
      return;
    }
    const current = projectsRef.current.find((project) => project.id === projectId);
    if (!current) return;
    const next = {
      ...current,
      knowledge: current.knowledge.filter((file) => file.id !== fileId),
      updatedAt: Date.now(),
    };
    setProjects((currentProjects) => {
      const nextProjects = currentProjects.map((project) => (project.id === projectId ? next : project));
      projectsRef.current = nextProjects;
      return nextProjects;
    });
    persistSharedProject(next);
  }, [isAdmin, notify, persistSharedProject]);

  const value = useMemo<ChatContextValue>(() => ({
    conversations,
    projects,
    activeConversation: conversations.find((item) => item.id === activeId) ?? null,
    activeProject,
    activeId,
    activeProjectId,
    visibleConversations,
    hydrated,
    generating,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation: (id, title) =>
      mutateConversation(id, (current) => ({
        ...current,
        title: title.trim().slice(0, 60) || current.title,
        titleMode: title.trim() ? "manual" : current.titleMode,
        titleGenerated: title.trim() ? true : current.titleGenerated,
        updatedAt: Date.now(),
      })),
    updateConversation: (id, patch) =>
      mutateConversation(id, (current) => ({ ...current, ...patch, updatedAt: Date.now() })),
    createProject,
    updateProject,
    deleteProject,
    selectProject,
    addProjectKnowledge,
    removeProjectKnowledge,
    sendMessage,
    stopGeneration: () => abortRef.current?.abort(),
    regenerateMessage,
    continueGeneration,
    editMessage: (messageId, content) =>
      activeId &&
      mutateConversation(activeId, (current) => ({
        ...current,
        messages: current.messages.map((message) =>
          message.id === messageId ? { ...message, content } : message,
        ),
        updatedAt: Date.now(),
      })),
    deleteMessage: (messageId) =>
      activeId &&
      mutateConversation(activeId, (current) => ({
        ...current,
        messages: current.messages.filter((message) => message.id !== messageId),
        updatedAt: Date.now(),
      })),
  }), [
    conversations,
    projects,
    activeProject,
    activeId,
    activeProjectId,
    visibleConversations,
    hydrated,
    generating,
    createConversation,
    selectConversation,
    deleteConversation,
    mutateConversation,
    createProject,
    updateProject,
    addProjectKnowledge,
    removeProjectKnowledge,
    deleteProject,
    selectProject,
    sendMessage,
    regenerateMessage,
    continueGeneration,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used inside ChatProvider");
  return context;
}
