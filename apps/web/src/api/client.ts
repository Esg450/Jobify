export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The parsed JSON body, for errors that carry more than a message (such as 409s). */
    readonly body: unknown = undefined,
  ) {
    super(message);
  }
}

/** Called when the server reports that the session has expired. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

type Query = Record<string, string | number | boolean | string[] | undefined>;

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
      continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const search = params.toString();
  return `/api${path}${search ? `?${search}` : ''}`;
}

async function toApiError(response: Response): Promise<ApiError> {
  const fallback = response.statusText || `Request failed with status ${response.status}`;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Not JSON; use the status text.
    return new ApiError(response.status, fallback);
  }
  const { message } = (body ?? {}) as { message?: string | string[] };
  const text = Array.isArray(message) ? message.join('. ') : message || fallback;
  return new ApiError(response.status, text, body);
}

export async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; query?: Query } = {},
): Promise<T> {
  const response = await fetch(buildUrl(path, options.query), {
    method,
    credentials: 'same-origin',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 401 && !path.startsWith('/auth')) onUnauthorized();
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: (path: string) => request<void>('DELETE', path),
};
