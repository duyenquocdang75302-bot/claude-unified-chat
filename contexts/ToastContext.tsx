"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { X } from "lucide-react";
import { createId } from "@/lib/utils";

type ToastTone = "info" | "error" | "success";
type Toast = { id: string; message: string; tone: ToastTone };
type ToastContextValue = { notify: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    const id = createId("toast");
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-soft backdrop-blur ${
              toast.tone === "error"
                ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/90 dark:text-red-100"
                : toast.tone === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-100"
                  : "border-line bg-panel/95 text-ink"
            }`}
          >
            <span className="flex-1">{toast.message}</span>
            <button aria-label="关闭提示" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
