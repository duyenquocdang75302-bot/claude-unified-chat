"use client";

import { useEffect, useState } from "react";
import { fallbackModels } from "@/lib/model-utils";
import type { ModelInfo, ModelsResponse } from "@/types/model";
import { useToast } from "@/contexts/ToastContext";

export function useModels() {
  const [models, setModels] = useState<ModelInfo[]>(fallbackModels());
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/models", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("模型列表加载失败");
        return response.json() as Promise<ModelsResponse>;
      })
      .then((data) => {
        setModels(data.data);
        if (data.warning) notify(data.warning);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") notify("模型列表加载失败，已使用默认列表", "error");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [notify]);

  return { models, loading };
}
