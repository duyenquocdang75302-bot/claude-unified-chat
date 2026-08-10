import type { ChatParameters } from "@/types/chat";

export type ThemePreference = "system" | "light" | "dark";

export interface AppSettings extends ChatParameters {
  defaultModel: string;
  theme: ThemePreference;
}
