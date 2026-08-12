import { DEFAULT_SETTINGS } from "@/lib/constants";
import type { ChatProject, Conversation } from "@/types/chat";
import type { AppSettings } from "@/types/settings";

const CONVERSATIONS_KEY = "claude-chat:conversations:v1";
const ACTIVE_KEY = "claude-chat:active:v1";
const SETTINGS_KEY = "claude-chat:settings:v1";
const PROJECTS_KEY = "claude-chat:projects:v1";
const ACTIVE_PROJECT_KEY = "claude-chat:active-project:v1";
const DATABASE_NAME = "claude-chat";
const DATABASE_VERSION = 1;
const STORE_NAME = "app-state";

let databasePromise: Promise<IDBDatabase> | null = null;
const loadPromises = new Map<string, Promise<unknown>>();
let storageScope = "anonymous";
let migrateLegacyData = false;

export function setStorageScope(scope: string, migrateLegacy: boolean) {
  const normalized = scope.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "anonymous";
  if (normalized !== storageScope) loadPromises.clear();
  storageScope = normalized;
  migrateLegacyData = migrateLegacy;
}

function scopedKey(key: string) {
  return `${key}:account:${storageScope}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readScopedJson<T>(key: string, fallback: T): T {
  const accountKey = scopedKey(key);
  if (typeof window === "undefined") return fallback;
  try {
    const scoped = window.localStorage.getItem(accountKey);
    if (scoped) return JSON.parse(scoped) as T;
    if (!migrateLegacyData) return fallback;
    const legacy = window.localStorage.getItem(key);
    if (!legacy) return fallback;
    window.localStorage.setItem(accountKey, legacy);
    window.localStorage.removeItem(key);
    return JSON.parse(legacy) as T;
  } catch {
    return fallback;
  }
}

function writeScopedJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopedKey(key), JSON.stringify(value));
}

function openDatabase() {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB 不可用"));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开浏览器数据库"));
  });
  return databasePromise;
}

async function readIndexedValue<T>(key: string) {
  const database = await openDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error("读取浏览器数据库失败"));
  });
}

async function writeIndexedValue<T>(key: string, value: T) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("写入浏览器数据库失败"));
    transaction.onabort = () => reject(transaction.error ?? new Error("写入浏览器数据库已取消"));
    transaction.objectStore(STORE_NAME).put(value, key);
  });
}

async function deleteIndexedValue(key: string) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("清理旧浏览器数据失败"));
    transaction.onabort = () => reject(transaction.error ?? new Error("清理旧浏览器数据已取消"));
    transaction.objectStore(STORE_NAME).delete(key);
  });
}

function removeLegacyValue(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // IndexedDB 已保存成功时，旧副本删除失败不影响数据。
  }
}

function loadLargeValue<T>(key: string, fallback: T): Promise<T> {
  const accountKey = scopedKey(key);
  const existing = loadPromises.get(accountKey) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      const stored = await readIndexedValue<T>(accountKey);
      if (stored !== undefined) {
        return stored;
      }

      let legacy = fallback;
      let migratedFromIndexedDb = false;
      if (migrateLegacyData) {
        const indexedLegacy = await readIndexedValue<T>(key);
        if (indexedLegacy !== undefined) {
          legacy = indexedLegacy;
          migratedFromIndexedDb = true;
        } else {
          legacy = readJson<T>(key, fallback);
        }
      }
      await writeIndexedValue(accountKey, legacy);
      if (migrateLegacyData) {
        if (migratedFromIndexedDb) await deleteIndexedValue(key);
        removeLegacyValue(key);
      }
      return legacy;
    } catch {
      return readScopedJson<T>(key, fallback);
    }
  })();
  loadPromises.set(accountKey, promise);
  return promise;
}

async function saveLargeValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  if (!window.indexedDB) {
    writeScopedJson(key, value);
    return;
  }
  await writeIndexedValue(scopedKey(key), value);
  if (migrateLegacyData) removeLegacyValue(key);
}

export function loadConversations() {
  return loadLargeValue<Conversation[]>(CONVERSATIONS_KEY, []);
}

export function saveConversations(conversations: Conversation[]) {
  return saveLargeValue(CONVERSATIONS_KEY, conversations);
}

export function loadActiveConversationId() {
  return readScopedJson<string | null>(ACTIVE_KEY, null);
}

export function saveActiveConversationId(id: string | null) {
  writeScopedJson(ACTIVE_KEY, id);
}

export function loadSettings(): AppSettings {
  const stored = readScopedJson<Partial<AppSettings>>(SETTINGS_KEY, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(settings: AppSettings) {
  writeScopedJson(SETTINGS_KEY, settings);
}

export function loadProjects() {
  return loadLargeValue<ChatProject[]>(PROJECTS_KEY, []);
}

export function saveProjects(projects: ChatProject[]) {
  return saveLargeValue(PROJECTS_KEY, projects);
}

export function loadActiveProjectId() {
  return readScopedJson<string | null>(ACTIVE_PROJECT_KEY, null);
}

export function saveActiveProjectId(id: string | null) {
  writeScopedJson(ACTIVE_PROJECT_KEY, id);
}
