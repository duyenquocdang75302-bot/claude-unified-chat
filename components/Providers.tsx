"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ToastProvider } from "@/contexts/ToastContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <SettingsProvider>
          <ChatProvider>{children}</ChatProvider>
        </SettingsProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
