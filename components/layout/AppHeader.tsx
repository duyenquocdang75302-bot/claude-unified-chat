"use client";

import { Menu, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { ModelSelector } from "@/components/models/ModelSelector";
import { ParameterPanel } from "@/components/settings/ParameterPanel";
import { Button } from "@/components/ui/Button";
import type { ChatParameters } from "@/types/chat";
import type { ModelInfo } from "@/types/model";

export function AppHeader({ model, models, modelsLoading, parameters, onOpenSidebar, onModelChange, onParametersChange }: {
  model: string;
  models: ModelInfo[];
  modelsLoading: boolean;
  parameters: ChatParameters;
  onOpenSidebar: () => void;
  onModelChange: (model: string) => void;
  onParametersChange: (parameters: ChatParameters) => void;
}) {
  const [parametersOpen, setParametersOpen] = useState(false);
  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-line bg-canvas/85 px-3 backdrop-blur sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <Button size="icon" variant="ghost" className="lg:hidden" onClick={onOpenSidebar} aria-label="打开侧栏"><Menu className="h-5 w-5" /></Button>
        <ModelSelector model={model} models={models} loading={modelsLoading} onChange={onModelChange} />
      </div>
      <Button size="icon" variant="ghost" onClick={() => setParametersOpen((open) => !open)} aria-label="会话参数"><SlidersHorizontal className="h-5 w-5" /></Button>
      {parametersOpen ? <ParameterPanel parameters={parameters} onChange={onParametersChange} onClose={() => setParametersOpen(false)} /> : null}
    </header>
  );
}
