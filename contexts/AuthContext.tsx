"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setStorageScope } from "@/lib/storage";

export type AuthUser = {
  id: string;
  username: string;
  role: "admin" | "user";
};

type AuthContextValue = {
  enabled: boolean;
  user: AuthUser | null;
  ready: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { enabled?: boolean; authenticated?: boolean; user?: AuthUser | null }) => {
        if (cancelled) return;
        const nextUser = data.authenticated ? data.user ?? null : null;
        setEnabled(Boolean(data.enabled));
        setUser(nextUser);
        setStorageScope(nextUser?.id ?? "anonymous", nextUser?.role === "admin");
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setStorageScope("anonymous", false);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ enabled, user, ready }), [enabled, user, ready]);
  if (!ready) {
    return <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-muted">正在载入账号…</div>;
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
