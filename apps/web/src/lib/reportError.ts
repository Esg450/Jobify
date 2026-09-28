const recentlyReported = new Set<string>();

/**
 * Sends a browser error to the server log. Best effort: failures are ignored, and the same
 * message is only sent once a minute so a render loop can't flood the log.
 */
export function reportError(error: unknown): void {
  const { message, stack } =
    error instanceof Error ? error : { message: String(error), stack: undefined };
  if (!message || recentlyReported.has(message)) return;

  recentlyReported.add(message);
  setTimeout(() => recentlyReported.delete(message), 60_000);

  // Plain fetch rather than the API client, so a failed report never triggers more handling.
  void fetch('/api/logs/client', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message.slice(0, 2_000),
      stack: stack?.slice(0, 10_000),
      url: location.pathname,
    }),
  }).catch(() => {});
}

export function reportUncaughtErrors(): void {
  window.addEventListener('error', (event) => reportError(event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason));
}
