export const AUTH_COOKIE = "claude_chat_access";

export type UserRole = "admin" | "user";

export type AuthSession = {
  id: string;
  username: string;
  role: UserRole;
  keySlot: 1 | 2;
  expiresAt: number;
};

type ConfiguredAccount = Omit<AuthSession, "expiresAt"> & {
  password: string;
};

const SESSION_AGE_SECONDS = 60 * 60 * 24 * 30;

function configuredAccounts(): ConfiguredAccount[] {
  const accounts: Array<ConfiguredAccount | null> = [
    process.env.CHAT_ADMIN_PASSWORD
      ? {
          id: "admin",
          username: process.env.CHAT_ADMIN_USERNAME?.trim() || "admin",
          password: process.env.CHAT_ADMIN_PASSWORD,
          role: "admin",
          keySlot: 1,
        }
      : null,
    process.env.CHAT_USER_1_PASSWORD
      ? {
          id: "user1",
          username: process.env.CHAT_USER_1_USERNAME?.trim() || "team1",
          password: process.env.CHAT_USER_1_PASSWORD,
          role: "user",
          keySlot: 1,
        }
      : null,
    process.env.CHAT_USER_2_PASSWORD
      ? {
          id: "user2",
          username: process.env.CHAT_USER_2_USERNAME?.trim() || "team2",
          password: process.env.CHAT_USER_2_PASSWORD,
          role: "user",
          keySlot: 2,
        }
      : null,
  ];
  const multiUserAccounts = accounts.filter((account): account is ConfiguredAccount => Boolean(account));
  if (multiUserAccounts.length) return multiUserAccounts;

  const legacyPassword = process.env.ACCESS_PASSWORD;
  if (!legacyPassword) return [];
  return [
    {
      id: "admin",
      username: "admin",
      password: legacyPassword,
      role: "admin",
      keySlot: 1,
    },
  ];
}

export function isAuthenticationEnabled() {
  return configuredAccounts().length > 0;
}

function authSecret() {
  const explicit = process.env.AUTH_SECRET;
  if (explicit) return explicit;
  const accounts = configuredAccounts();
  return process.env.ACCESS_PASSWORD || accounts.map((account) => account.password).join(":") || "local-development";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function securePasswordEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(left)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(right)),
  ]);
  return constantTimeEqual(
    bytesToBase64Url(new Uint8Array(leftHash)),
    bytesToBase64Url(new Uint8Array(rightHash)),
  );
}

export async function authenticateCredentials(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const account = configuredAccounts().find((candidate) => candidate.username.toLowerCase() === normalizedUsername);
  if (!account || !(await securePasswordEqual(password, account.password))) return null;
  const { password: _password, ...publicAccount } = account;
  return publicAccount;
}

export async function createSessionToken(account: Omit<AuthSession, "expiresAt">) {
  const session: AuthSession = {
    ...account,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_AGE_SECONDS,
  };
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token?: string | null): Promise<AuthSession | null> {
  if (!isAuthenticationEnabled()) {
    return {
      id: "admin",
      username: "admin",
      role: "admin",
      keySlot: 1,
      expiresAt: Math.floor(Date.now() / 1000) + SESSION_AGE_SECONDS,
    };
  }
  if (!token) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length || !constantTimeEqual(signature, await sign(payload))) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as AuthSession;
    if (
      !session.id ||
      !session.username ||
      !["admin", "user"].includes(session.role) ||
      ![1, 2].includes(session.keySlot) ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    const account = configuredAccounts().find(
      (candidate) =>
        candidate.id === session.id &&
        candidate.username === session.username &&
        candidate.role === session.role &&
        candidate.keySlot === session.keySlot,
    );
    return account ? session : null;
  } catch {
    return null;
  }
}

export async function sessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${AUTH_COOKIE}=`))
    ?.slice(AUTH_COOKIE.length + 1);
  return verifySessionToken(token ? decodeURIComponent(token) : null);
}

export function apiKeyForSession(session: AuthSession | null) {
  const key =
    session?.keySlot === 2
      ? process.env.OPENAI_API_KEY_USER_2
      : process.env.OPENAI_API_KEY_USER_1 || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("当前账号尚未配置 API Key，请联系管理员");
  return key;
}
