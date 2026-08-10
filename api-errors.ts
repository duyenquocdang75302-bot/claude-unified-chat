export function friendlyUpstreamError(status: number, detail = "") {
  const normalized = detail.toLowerCase();
  if (status === 401) return "API Key 无效，请检查配置";
  if (status === 429) return "请求过于频繁，请稍后再试";
  if (status === 402) return "账户余额不足，请前往中转站充值";
  if (status === 403) {
    if (/balance|billing|credit|insufficient|quota|余额|额度|欠费/.test(normalized)) {
      return "账户余额或 Key 额度不足，请检查中转站账户与 Key 配额";
    }
    return "当前 Key 无权调用该模型或所在分组渠道不可用，请检查 Key 分组和模型权限";
  }
  if (status === 404) return "中转站未找到该模型，请重新选择模型";
  if (status === 413) return "请求内容过大，请减少图片或文件数量";
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return "中转站或模型渠道暂时不可用，请稍后重试";
  }
  return `上游服务请求失败（${status}）`;
}

export function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}
