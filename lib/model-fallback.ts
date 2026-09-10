export function modelFallbackCandidates(requestedModel: string, configuredModels: string | undefined) {
  const seen = new Set([requestedModel.trim().toLowerCase()]);
  return (configuredModels ?? "")
    .split(/[\s,;]+/)
    .map((model) => model.trim())
    .filter((model) => {
      const normalized = model.toLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

export function isUnavailableModelChannel(status: number, detail: string) {
  return status === 424 && /no account is available|no available account|account.*unavailable|无可用账号/i.test(detail);
}

export function isUnsupportedTemperature(status: number, detail: string) {
  return status === 400 &&
    /(?:temperature.{0,80}(?:deprecated|not supported|unsupported|not allowed)|(?:deprecated|not supported|unsupported|not allowed).{0,80}temperature)/i.test(detail);
}

export function shouldTryNextFallback(status: number, detail: string) {
  if (isUnavailableModelChannel(status, detail) || status === 404) return true;
  if ([502, 503, 504, 524].includes(status)) return true;
  return status === 403 && !/balance|billing|credit|insufficient|quota|余额|额度|欠费/i.test(detail);
}
