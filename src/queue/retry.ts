/** Growing wait for retries: doubles each attempt, small random extra, capped. */
export function retryDelayMs(attemptNumber: number, baseMs = 1_000, capMs = 60_000): number {
  const exponent = Math.max(0, attemptNumber - 1);
  const doubled = baseMs * 2 ** exponent;
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(doubled + jitter, capMs);
}
