/**
 * Node's fetch reports network failures as a bare "fetch failed"; the useful part (DNS
 * failure, refused connection, bad certificate, ...) is in `cause`.
 */
export function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (error.name === 'TimeoutError') return 'the request timed out';
  const cause = error.cause as { code?: string; message?: string } | undefined;
  const detail = cause?.code ?? cause?.message;
  return detail ? `${error.message} (${detail})` : error.message;
}
