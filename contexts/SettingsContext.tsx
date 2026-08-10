"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { loadSettings, saveSettings } from "@/lib/storage";
import type { AppSettings } from "@/types/settings";

type SettingsContextValue = {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  hydrated: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyTheme(theme: AppSettings["theme"]) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSettings(settings);
    applyTheme(settings.theme);
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [settings, hydrated]);

  const value = useMemo(
    () => ({ settings, updateSettings: (patch: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...patch })), hydrated }),
    [settings, hydrated],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}
