const RETRIES_BY_STATUS: Readonly<Record<number, readonly number[]>> = {
  // 424 from the relay means its selected model account/channel is temporarily
  // unavailable. Give the pool time to recover or select another account.
  424: [1_200, 2_500, 5_000],
  502: [800],
  503: [800],
  504: [800],
  524: [800],
};

export function chatRetryDelayMs(status: number, failedAttempt: number) {
  return RETRIES_BY_STATUS[status]?.[failedAttempt] ?? null;
}

export function exhaustedChatError(status: number) {
  if (status === 424) {
    return "当前模型渠道暂无可用账号，已自动重试 3 次仍未恢复；请稍后重新生成或先切换其他模型";
  }
  if (status === 524) {
    return "中转站响应超时，已自动重试但仍未恢复；请稍后点击“重新生成”";
  }
  return null;
}
